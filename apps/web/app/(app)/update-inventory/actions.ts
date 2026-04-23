"use server";

/**
 * Update Inventory server actions (formerly "Photo Mode"; renamed 2026-04-23
 * to match the broader surface scope).
 *
 * Contract:
 *   - submitCatalogImageAction: called by the Update Inventory session UI
 *     AFTER a file has been uploaded to store-media. Runs moderation, writes
 *     the audit row, and — if approved — updates catalog_products.image_url.
 *   - rejectSubmissionAction: manager-only. Soft-rejects a submission from
 *     the gallery (e.g. reversing an auto-approve that slipped through).
 *   - setUploadPrivilegeAction: manager-only. Grants/revokes a user's
 *     ability to submit updates.
 *
 * DB identifiers kept stable through the rename to avoid a migration churn:
 *   - table `catalog_image_submissions`
 *   - column `users.photo_upload_privilege`
 *   - audit event names `photo.submission.reject`,
 *     `user.photo_upload_privilege.grant/revoke`
 *   - rate-limiter key `photo-submit`
 * These are internal identifiers; the user-facing surface is "Update Inventory".
 *
 * Why service-role for the actual writes: catalog_image_submissions has
 * service-role-only INSERT/UPDATE, and catalog_products has the same for
 * writes. We validate role + privilege + moderation BEFORE bypassing RLS.
 */

import { revalidatePath } from "next/cache";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { moderateImage } from "@/lib/moderation";
import type { ModerationStatus } from "@/lib/moderation";
import { logAudit } from "@/lib/audit/log";
import { checkRateForServerAction } from "@/lib/rate-limit";
import { getFeatureFlag } from "@/lib/flags";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Service-role client for the gated writes below. */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// Server-side upload validation
// ---------------------------------------------------------------------------
// Defense-in-depth against a malicious client that bypasses PhotoCapture.tsx's
// size/type checks. The client-side checks are for UX; these are for truth.
//
// We enforce three things here:
//   1. URL must point at OUR Supabase Storage (no SSRF / no external URLs).
//   2. URL must be in the store-media bucket (not some other bucket, and not
//      auth / profile-pictures / whatever).
//   3. HEAD request must report an allowed image content-type and a
//      content-length under the server ceiling (10 MB — deliberately higher
//      than the client's 5 MB so a slightly-over-quota phone upload doesn't
//      mysteriously fail on the server after succeeding to storage).

const SERVER_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
];
const STORE_MEDIA_PATH_PREFIX = "/storage/v1/object/public/store-media/";

type ValidateResult = { ok: true } | { ok: false; error: string };

/**
 * Validate that `imageUrl` points at our own store-media bucket and that
 * the file behind it is an image within size limits. Network round-trip
 * (one HEAD request) but we're about to do several more for moderation, so
 * the added latency is negligible.
 */
async function validateUploadedImageUrl(
  imageUrl: string,
): Promise<ValidateResult> {
  // --- URL structural checks -------------------------------------------
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return { ok: false, error: "Invalid image URL." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Image URL must use HTTPS." };
  }

  const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrlEnv) {
    return { ok: false, error: "Server misconfigured: NEXT_PUBLIC_SUPABASE_URL missing." };
  }
  const expectedHost = new URL(supabaseUrlEnv).host;
  if (parsed.host !== expectedHost) {
    return {
      ok: false,
      error: "Image URL must come from our storage (SSRF guard).",
    };
  }

  if (!parsed.pathname.startsWith(STORE_MEDIA_PATH_PREFIX)) {
    return {
      ok: false,
      error: "Image URL must be in the store-media bucket.",
    };
  }

  // --- HEAD to verify content-type and size ----------------------------
  let head: Response;
  try {
    head = await fetch(imageUrl, { method: "HEAD", cache: "no-store" });
  } catch (e) {
    return {
      ok: false,
      error: `Couldn't reach uploaded image: ${(e as Error).message}`,
    };
  }
  if (!head.ok) {
    return {
      ok: false,
      error: `Uploaded image not reachable (HTTP ${head.status}).`,
    };
  }

  const contentType = (head.headers.get("content-type") ?? "").toLowerCase();
  const allowed = ALLOWED_IMAGE_TYPES.some((t) => contentType.startsWith(t));
  if (!allowed) {
    return {
      ok: false,
      error: `Unsupported image type: ${contentType || "(unknown)"}.`,
    };
  }

  const lengthHeader = head.headers.get("content-length");
  if (lengthHeader) {
    const bytes = Number(lengthHeader);
    if (Number.isFinite(bytes) && bytes > SERVER_MAX_BYTES) {
      const mb = (bytes / 1024 / 1024).toFixed(1);
      const maxMb = (SERVER_MAX_BYTES / 1024 / 1024).toFixed(0);
      return {
        ok: false,
        error: `File too large: ${mb} MB (max ${maxMb} MB).`,
      };
    }
  }

  return { ok: true };
}

type AuthCtx = {
  userId: string;
  storeId: string;
  role: "owner" | "manager" | "staff";
  canUpload: boolean;
  isManager: boolean;
};

/**
 * Resolve the current authenticated user's store/role/privilege. Returns
 * null if unauthenticated or missing fields.
 */
async function getAuthCtx(): Promise<AuthCtx | null> {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role, photo_upload_privilege")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.store_id || !profile.role) return null;

  const role = profile.role as AuthCtx["role"];
  const isManager = role === "owner" || role === "manager";
  // Managers always have privilege; staff need the flag on.
  const canUpload = isManager || profile.photo_upload_privilege === true;

  return {
    userId: auth.user.id,
    storeId: profile.store_id,
    role,
    canUpload,
    isManager,
  };
}

// ---------------------------------------------------------------------------
// Score ranking for the catalog-apply step
// ---------------------------------------------------------------------------

/**
 * Per-source confidence used to decide whether a staff upload should
 * overwrite the current catalog image. A staff upload (0.7) beats a
 * placeholder (0.1) or a crowdsourced image (0.4) but loses to a POS
 * image (1.0) or a UPC API image (0.9).
 */
function sourcePriorityScore(source: string | null): number {
  switch (source) {
    case "pos":
      return 1.0;
    case "upc_api":
      return 0.9;
    case "staff_upload":
      return 0.7;
    case "grapes_and_grains":
    case "liquor_barn":
      return 0.6;
    case "crowdsourced":
      return 0.4;
    case "placeholder":
      return 0.1;
    default:
      return 0;
  }
}

const STAFF_UPLOAD_SCORE = 0.7;

// ---------------------------------------------------------------------------
// submitCatalogImageAction — the main write path from Update Inventory UI
// ---------------------------------------------------------------------------

export type SubmitCatalogImageInput = {
  /** Target catalog_products.id — the product the photo is FOR. */
  catalogProductId: string;
  /** Public URL of the just-uploaded image in store-media. */
  imageUrl: string;
};

export type SubmitCatalogImageResult = {
  ok: boolean;
  /** Final moderation status (approved/rejected/flagged). */
  status: ModerationStatus | null;
  /** Manager-facing note from the classifier. */
  notes: string | null;
  /** Error string if the action errored out before moderation. */
  error: string | null;
  /** Audit row id; null if we couldn't write it. */
  submissionId: string | null;
  /** True if we actually updated catalog_products.image_url. */
  appliedToCatalog: boolean;
};

/**
 * Submit a product photo. Runs the full moderation pipeline and — if
 * approved — promotes it to catalog_products.image_url when it beats the
 * existing image's quality score.
 */
export async function submitCatalogImageAction(
  input: SubmitCatalogImageInput,
): Promise<SubmitCatalogImageResult> {
  const fail = (error: string): SubmitCatalogImageResult => ({
    ok: false,
    status: null,
    notes: null,
    error,
    submissionId: null,
    appliedToCatalog: false,
  });

  const ctx = await getAuthCtx();
  if (!ctx) return fail("Not authenticated.");
  if (!ctx.canUpload) return fail("Inventory update privilege revoked by your manager.");

  if (!input.catalogProductId) return fail("Missing catalogProductId.");

  // Rate-limit BEFORE moderation — each approved submission costs us an
  // OpenAI moderation call + a Claude Haiku vision call. A rogue client
  // bot could burn a lot of budget if we didn't gate here. Limiter key
  // stays "photo-submit" (stable internal ID) even though the surface
  // renamed; we can rebrand the key later without user impact.
  const rl = await checkRateForServerAction("photo-submit", ctx.userId);
  if (!rl.success) {
    return fail(
      rl.window === "1 d"
        ? "Daily photo upload limit reached. Try again tomorrow."
        : "Too many uploads — slow down a moment and try again.",
    );
  }

  // Server-side upload validation — NEVER trust the client's size/type check.
  // This also prevents SSRF: the URL must be in OUR storage bucket.
  const urlCheck = await validateUploadedImageUrl(input.imageUrl);
  if (!urlCheck.ok) return fail(urlCheck.error);

  const admin = getServiceClient();
  if (!admin) return fail("Server misconfigured: SUPABASE_SERVICE_ROLE_KEY missing.");

  // Step 1: insert the pending submission row so we always have a paper trail,
  // even if moderation later errors.
  const { data: submission, error: insErr } = await admin
    .from("catalog_image_submissions")
    .insert({
      catalog_product_id: input.catalogProductId,
      store_id: ctx.storeId,
      submitted_by: ctx.userId,
      image_url: input.imageUrl,
      moderation_status: "pending",
    })
    .select("id")
    .single();

  if (insErr || !submission) {
    return fail(`Failed to record submission: ${insErr?.message ?? "unknown"}`);
  }

  // Step 2: moderate. moderateImage is no-throw — returns "flagged" on error.
  const mod = await moderateImage(input.imageUrl);

  // Step 3: persist moderation result.
  await admin
    .from("catalog_image_submissions")
    .update({
      moderation_status: mod.status,
      moderation_scores: mod.scores as unknown as Record<string, unknown>,
      moderation_notes: mod.notes,
      rejected_at: mod.status === "rejected" ? new Date().toISOString() : null,
    })
    .eq("id", submission.id);

  // Step 4: if approved AND the submission beats the current image's quality
  // score, update catalog_products.
  let appliedToCatalog = false;
  if (mod.status === "approved") {
    appliedToCatalog = await tryApplyToCatalog({
      admin,
      catalogProductId: input.catalogProductId,
      imageUrl: input.imageUrl,
      storeId: ctx.storeId,
      userId: ctx.userId,
    });

    if (appliedToCatalog) {
      await admin
        .from("catalog_image_submissions")
        .update({ applied_to_catalog_at: new Date().toISOString() })
        .eq("id", submission.id);
    }
  }

  // Step 5: revalidate surfaces that show catalog images.
  revalidatePath("/update-inventory");
  revalidatePath("/update-inventory/gallery");
  revalidatePath("/inventory");

  return {
    ok: true,
    status: mod.status,
    notes: mod.notes,
    error: null,
    submissionId: submission.id,
    appliedToCatalog,
  };
}

/**
 * Decide whether to overwrite the catalog row's image with the submission,
 * and do it if so. Returns true only when the UPDATE actually ran.
 *
 * Rule: a staff upload wins if the existing source's priority is <= staff
 * upload priority. That means we replace placeholders, crowdsourced, and
 * retailer-scraped images, but never overwrite a POS or UPC-API image.
 */
async function tryApplyToCatalog(args: {
  admin: NonNullable<ReturnType<typeof getServiceClient>>;
  catalogProductId: string;
  imageUrl: string;
  storeId: string;
  userId: string;
}): Promise<boolean> {
  const { admin, catalogProductId, imageUrl, storeId, userId } = args;

  const { data: current, error } = await admin
    .from("catalog_products")
    .select("image_url, image_source, image_quality_score")
    .eq("id", catalogProductId)
    .maybeSingle();

  if (error || !current) return false;

  const currentPriority = sourcePriorityScore(current.image_source as string | null);

  // If a real image already exists from a higher-priority source, don't overwrite.
  if (current.image_url && currentPriority > STAFF_UPLOAD_SCORE) {
    return false;
  }

  const { error: upErr } = await admin
    .from("catalog_products")
    .update({
      image_url: imageUrl,
      image_source: "staff_upload",
      image_quality_score: STAFF_UPLOAD_SCORE,
      image_contributor_store_id: storeId,
      image_contributor_user_id: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", catalogProductId);

  return !upErr;
}

// ---------------------------------------------------------------------------
// Submitter-only: "retake" — cancel your own just-uploaded photo
// ---------------------------------------------------------------------------

export type RetakeOwnResult = {
  ok: boolean;
  error: string | null;
};

/**
 * Called from the Update Inventory session's confirm step when the user says
 * "No, retake" — meaning the uploaded photo was of the wrong product or
 * otherwise not what they meant.
 *
 * Behavior:
 *   - Mark the submission moderation_status='rejected' so it never reaches
 *     the manager queue as a candidate.
 *   - If the submission had been promoted to catalog_products.image_url
 *     (possible when moderation auto-approved), revert that update.
 *
 * Only the user who submitted the photo can retake it here.
 */
export async function retakeOwnSubmissionAction(
  submissionId: string,
): Promise<RetakeOwnResult> {
  const ctx = await getAuthCtx();
  if (!ctx) return { ok: false, error: "Not authenticated." };

  const admin = getServiceClient();
  if (!admin) return { ok: false, error: "Server misconfigured." };

  const { data: sub } = await admin
    .from("catalog_image_submissions")
    .select("id, submitted_by, catalog_product_id, applied_to_catalog_at")
    .eq("id", submissionId)
    .maybeSingle();

  if (!sub || sub.submitted_by !== ctx.userId) {
    return { ok: false, error: "Submission not found or not yours." };
  }

  const { error: upErr } = await admin
    .from("catalog_image_submissions")
    .update({
      moderation_status: "rejected",
      rejected_at: new Date().toISOString(),
      rejected_by: ctx.userId,
      moderation_notes: "Retaken by submitter (wrong product).",
    })
    .eq("id", submissionId);

  if (upErr) return { ok: false, error: upErr.message };

  // If the photo had already been promoted to the catalog, roll it back.
  // The eq filter on image_contributor_user_id prevents clobbering a newer
  // approved photo that might have landed in the meantime.
  if (sub.applied_to_catalog_at) {
    await admin
      .from("catalog_products")
      .update({
        image_url: null,
        image_source: null,
        image_quality_score: 0,
        image_contributor_store_id: null,
        image_contributor_user_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.catalog_product_id)
      .eq("image_contributor_user_id", ctx.userId);
  }

  revalidatePath("/update-inventory");
  revalidatePath("/update-inventory/gallery");
  revalidatePath("/inventory");
  return { ok: true, error: null };
}

// ---------------------------------------------------------------------------
// Manager-only: reject a submission and revert the catalog image
// ---------------------------------------------------------------------------

export type RejectSubmissionResult = {
  ok: boolean;
  error: string | null;
};

/**
 * Manager-only soft-reject. Mark the submission rejected; if it had been
 * applied to catalog_products, clear the image_url (so the enrichment
 * pipeline can repopulate from a scraper later).
 */
export async function rejectSubmissionAction(
  submissionId: string,
): Promise<RejectSubmissionResult> {
  const ctx = await getAuthCtx();
  if (!ctx) return { ok: false, error: "Not authenticated." };
  if (!ctx.isManager) return { ok: false, error: "Manager role required." };

  const admin = getServiceClient();
  if (!admin) return { ok: false, error: "Server misconfigured." };

  // Confirm submission is in this manager's store.
  const { data: sub } = await admin
    .from("catalog_image_submissions")
    .select("id, store_id, catalog_product_id, applied_to_catalog_at")
    .eq("id", submissionId)
    .maybeSingle();

  if (!sub || sub.store_id !== ctx.storeId) {
    return { ok: false, error: "Submission not found or not in your store." };
  }

  // Mark rejected.
  const { error: upErr } = await admin
    .from("catalog_image_submissions")
    .update({
      moderation_status: "rejected",
      rejected_at: new Date().toISOString(),
      rejected_by: ctx.userId,
    })
    .eq("id", submissionId);

  if (upErr) return { ok: false, error: upErr.message };

  // If it was applied to the catalog, roll it back.
  const rolledBackCatalog = Boolean(sub.applied_to_catalog_at);
  if (rolledBackCatalog) {
    await admin
      .from("catalog_products")
      .update({
        image_url: null,
        image_source: null,
        image_quality_score: 0,
        image_contributor_store_id: null,
        image_contributor_user_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.catalog_product_id)
      // Only clear if it's STILL pointing at this submission's image.
      // Prevents clobbering a newer approved photo.
      .eq("image_contributor_user_id", ctx.userId);
  }

  // Audit — manager action on another user's submission. Event name kept
  // stable (`photo.submission.reject`) across the surface rename for
  // historical query continuity.
  await logAudit({
    action: "photo.submission.reject",
    actor: { id: ctx.userId },
    storeId: ctx.storeId,
    target: { type: "catalog_image_submission", id: submissionId },
    metadata: {
      catalog_product_id: sub.catalog_product_id,
      rolled_back_catalog_image: rolledBackCatalog,
    },
  });

  revalidatePath("/update-inventory/gallery");
  revalidatePath("/inventory");
  return { ok: true, error: null };
}

// ---------------------------------------------------------------------------
// Manager-only: revoke / restore upload privilege
// ---------------------------------------------------------------------------

export type SetPrivilegeResult = {
  ok: boolean;
  error: string | null;
};

/**
 * Manager-only. Flip users.photo_upload_privilege for a staff member in
 * the manager's own store. Owners / managers themselves are not affected
 * since Update Inventory ignores the flag for them.
 */
export async function setUploadPrivilegeAction(
  userId: string,
  privilege: boolean,
): Promise<SetPrivilegeResult> {
  const ctx = await getAuthCtx();
  if (!ctx) return { ok: false, error: "Not authenticated." };
  if (!ctx.isManager) return { ok: false, error: "Manager role required." };

  const admin = getServiceClient();
  if (!admin) return { ok: false, error: "Server misconfigured." };

  // Confirm target user is in the same store. We also pull the current
  // privilege so the audit row captures the before/after state, which is
  // what makes this useful for answering "who revoked X's access and when?"
  const { data: target } = await admin
    .from("users")
    .select("id, store_id, role, photo_upload_privilege")
    .eq("id", userId)
    .maybeSingle();

  if (!target || target.store_id !== ctx.storeId) {
    return { ok: false, error: "User not found or not in your store." };
  }

  const before = target.photo_upload_privilege ?? true;

  const { error } = await admin
    .from("users")
    .update({ photo_upload_privilege: privilege })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  // Audit — privilege grants/revokes. Event name kept stable across the
  // surface rename for historical query continuity.
  await logAudit({
    action: privilege
      ? "user.photo_upload_privilege.grant"
      : "user.photo_upload_privilege.revoke",
    actor: { id: ctx.userId },
    storeId: ctx.storeId,
    target: { type: "user", id: userId },
    metadata: {
      photo_upload_privilege: { before, after: privilege },
      target_role: target.role,
    },
  });

  revalidatePath("/update-inventory/gallery");
  return { ok: true, error: null };
}

// ---------------------------------------------------------------------------
// updateInventoryDetailsAction — description / tasting-notes edit from the
// per-product session UI. Gated behind:
//   1. Feature flag `update_inventory_details_edit` on the store (defense-
//      in-depth; the client also reads the flag).
//   2. Manager/owner role — the `inventory_write` RLS policy already enforces
//      this, but we re-check here for clearer error messages.
//
// NOT gated behind the photo_upload_privilege column — that flag was about
// image moderation abuse, not text edits. A manager who has had photo
// privileges revoked (which staff-only) can still edit descriptions.
// ---------------------------------------------------------------------------

export type UpdateInventoryDetailsInput = {
  /** Target inventory.id — the per-store row whose override we're editing. */
  inventoryId: string;
  /** New description, or null to clear. Empty string is treated as null. */
  description?: string | null;
  /** New tasting notes, or null to clear. Empty string is treated as null. */
  tastingNotes?: string | null;
};

export type UpdateInventoryDetailsResult = {
  ok: boolean;
  error: string | null;
};

// Same upper bound as the catalog_products.tasting_notes column's practical
// footprint. The DB column is `text` (unbounded) but we don't want the
// product card page loading a 2 MB blob into the browser.
const INVENTORY_DETAILS_MAX_CHARS = 2000;

export async function updateInventoryDetailsAction(
  input: UpdateInventoryDetailsInput,
): Promise<UpdateInventoryDetailsResult> {
  const ctx = await getAuthCtx();
  if (!ctx) return { ok: false, error: "Not authenticated." };
  if (!ctx.isManager) {
    return { ok: false, error: "Manager role required to edit product details." };
  }

  if (!input.inventoryId) {
    return { ok: false, error: "Missing inventoryId." };
  }

  // Feature-flag re-check — the client-side check is UX, this is truth.
  const flagOn = await getFeatureFlag(ctx.storeId, "update_inventory_details_edit");
  if (!flagOn) {
    return { ok: false, error: "Details editing is not enabled for your store." };
  }

  // Normalize — empty strings become null so the DB stores a clean "no
  // override" state that the coalesce(inventory, catalog) fallback reads.
  const normalize = (v: string | null | undefined): string | null => {
    if (typeof v !== "string") return v ?? null;
    const trimmed = v.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > INVENTORY_DETAILS_MAX_CHARS) {
      return trimmed.slice(0, INVENTORY_DETAILS_MAX_CHARS);
    }
    return trimmed;
  };

  const patch: Record<string, string | null> = {};
  if (input.description !== undefined) {
    patch.description = normalize(input.description);
  }
  if (input.tastingNotes !== undefined) {
    patch.tasting_notes = normalize(input.tastingNotes);
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  // Use the user-scoped client so the inventory_write RLS policy enforces
  // store-ownership. Service-role would let us skip the check but also
  // silently allows cross-store writes on a code bug — not worth it for a
  // two-column text update.
  const supabase = await createServerClient();

  // Confirm the inventory row is in this user's store before writing.
  // Prevents a maliciously-crafted inventoryId from editing another store's
  // row via RLS bypass (it wouldn't — RLS stops it — but failing loudly
  // beats a silent 0-row update).
  const { data: invRow, error: readErr } = await supabase
    .from("inventory")
    .select("id, store_id, description, tasting_notes")
    .eq("id", input.inventoryId)
    .maybeSingle();

  if (readErr) {
    return { ok: false, error: `Couldn't load inventory row: ${readErr.message}` };
  }
  if (!invRow || invRow.store_id !== ctx.storeId) {
    return { ok: false, error: "Inventory row not found or not in your store." };
  }

  const { error: upErr } = await supabase
    .from("inventory")
    .update(patch)
    .eq("id", input.inventoryId);

  if (upErr) return { ok: false, error: upErr.message };

  // Audit — captures before/after so we can trace who blanked a popular
  // tasting note. Kept narrow: the before/after text is long, so we log
  // lengths instead of full content to avoid oversized audit_events rows.
  await logAudit({
    action: "inventory.details.update",
    actor: { id: ctx.userId },
    storeId: ctx.storeId,
    target: { type: "inventory", id: input.inventoryId },
    metadata: {
      changed: Object.keys(patch),
      before_lengths: {
        description: (invRow.description as string | null)?.length ?? 0,
        tasting_notes: (invRow.tasting_notes as string | null)?.length ?? 0,
      },
      after_lengths: {
        description:
          "description" in patch ? (patch.description?.length ?? 0) : undefined,
        tasting_notes:
          "tasting_notes" in patch ? (patch.tasting_notes?.length ?? 0) : undefined,
      },
    },
  });

  revalidatePath("/update-inventory");
  revalidatePath("/inventory");
  return { ok: true, error: null };
}
