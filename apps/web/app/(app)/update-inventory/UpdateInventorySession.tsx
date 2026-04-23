"use client";

/**
 * The core Update Inventory session — a mobile-first, single-product-at-a-
 * time flow that walks through the queue of products needing catalog data.
 *
 * History: shipped as "Photo Mode" (photo-only). Renamed to Update Inventory
 * 2026-04-23 when the scope broadened to also cover description, tasting
 * notes, and customer-visible review edits. Today the flow is still photo-
 * only; the hooks for the other fields will layer in without rewriting the
 * state machine (each added field is another "step" between capture and
 * confirm).
 *
 * UX contract (photo step, approved by user 2026-04-23):
 *   - Show one product card at a time.
 *   - Big "Take Photo" button opens camera on mobile (rear-facing).
 *   - After upload, a server action runs moderation in the background.
 *   - CONFIRMATION STEP: before advancing, show the uploaded photo next to
 *     the product name and ask "Is this the right product?" — moderation
 *     only catches 'is it a product photo at all', not 'is it THIS product'.
 *     User taps Yes to save + advance, or Retake to reject it and try again.
 *   - Hard rejections (not-a-product / explicit content) skip the confirm
 *     step and go straight to "Please retake" so the user doesn't get
 *     asked to confirm something that was never valid.
 *   - Skip button jumps to next without submitting.
 *   - Session ends when queue is exhausted or user taps "Done".
 */

import { useState, useTransition } from "react";
import Image from "next/image";
import { PhotoCapture } from "./PhotoCapture";
import { DetailsEdit } from "./DetailsEdit";
import {
  submitCatalogImageAction,
  retakeOwnSubmissionAction,
} from "./actions";

export type QueueItem = {
  catalog_product_id: string;
  canonical_name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  size_ml: number | null;
  existing_image_url: string | null;
  existing_image_source: string | null;
  // --- Inventory override fields (Task E, 2026-04-23) -----------------------
  // Present so managers can edit description + tasting notes inline from the
  // same session UI. The inventory_id keys the override row per-store; the
  // catalog tasting-notes column is the fallback shown to customers when the
  // store has no override of its own.
  inventory_id: string;
  inventory_description: string | null;
  inventory_tasting_notes: string | null;
  catalog_tasting_notes: string | null;
};

type Props = {
  storeId: string;
  queue: QueueItem[];
  /**
   * True when `update_inventory_details_edit` is on AND the current user is
   * an owner/manager. Purely a UI gate — the server action re-checks both.
   */
  canEditDetails: boolean;
};

type ResultState =
  | { kind: "idle" }
  | { kind: "submitting"; imageUrl: string }
  | {
      // Photo uploaded AND moderation passed (or was only flagged for manager
      // review). Ask the user to confirm it's the RIGHT product.
      kind: "confirm";
      status: "approved" | "flagged";
      notes: string;
      imageUrl: string;
      submissionId: string;
      appliedToCatalog: boolean;
    }
  | {
      // Moderation hard-rejected (not a product / explicit / etc). No confirm.
      kind: "rejected";
      notes: string;
      imageUrl: string;
    }
  | { kind: "saved"; imageUrl: string; appliedToCatalog: boolean };

// How long to flash the "Saved!" state before advancing to the next product.
const SAVED_ADVANCE_MS = 1000;

export function UpdateInventorySession({ storeId, queue, canEditDetails }: Props) {
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState<ResultState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  if (queue.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-2xl mb-2">🎉</p>
        <p className="text-lg font-semibold">All caught up!</p>
        <p className="text-sm text-[color:var(--color-muted)] mt-2">
          Every product your store carries has a catalog photo.
        </p>
      </div>
    );
  }

  if (idx >= queue.length) {
    return (
      <div className="text-center py-12">
        <p className="text-2xl mb-2">✅</p>
        <p className="text-lg font-semibold">Session complete</p>
        <p className="text-sm text-[color:var(--color-muted)] mt-2">
          Great work. Come back tomorrow for more.
        </p>
        <button
          type="button"
          onClick={() => setIdx(0)}
          className="mt-4 text-sm text-[color:var(--color-gold)] hover:underline"
        >
          Restart session
        </button>
      </div>
    );
  }

  const current = queue[idx];

  function next() {
    setResult({ kind: "idle" });
    setIdx((i) => i + 1);
  }

  function retryCurrent() {
    // Stay on the same product; just reset to the capture state.
    setResult({ kind: "idle" });
  }

  function onUploaded(publicUrl: string) {
    setResult({ kind: "submitting", imageUrl: publicUrl });
    startTransition(async () => {
      const res = await submitCatalogImageAction({
        catalogProductId: current.catalog_product_id,
        imageUrl: publicUrl,
      });

      // Hard errors (no submission even recorded) → treat as rejected.
      if (!res.ok || !res.status || !res.submissionId) {
        setResult({
          kind: "rejected",
          notes: res.error ?? "Upload failed.",
          imageUrl: publicUrl,
        });
        return;
      }

      if (res.status === "rejected") {
        setResult({
          kind: "rejected",
          notes: res.notes ?? "Photo didn't pass our auto-check.",
          imageUrl: publicUrl,
        });
        return;
      }

      // approved or flagged → ask the user to confirm it's the right product
      setResult({
        kind: "confirm",
        status: res.status === "pending" ? "flagged" : res.status,
        notes: res.notes ?? "",
        imageUrl: publicUrl,
        submissionId: res.submissionId,
        appliedToCatalog: res.appliedToCatalog,
      });
    });
  }

  /** User confirmed this is the right product → save + advance. */
  function onConfirm() {
    if (result.kind !== "confirm") return;
    const applied = result.appliedToCatalog;
    const img = result.imageUrl;
    setResult({ kind: "saved", imageUrl: img, appliedToCatalog: applied });
    setTimeout(next, SAVED_ADVANCE_MS);
  }

  /**
   * User wants to retake. Fire-and-forget the rollback server action — even
   * if it fails, we still reset the UI so they're not stuck.
   */
  function onRetake() {
    if (result.kind !== "confirm") {
      retryCurrent();
      return;
    }
    const submissionId = result.submissionId;
    startTransition(async () => {
      await retakeOwnSubmissionAction(submissionId);
      retryCurrent();
    });
  }

  return (
    <div className="max-w-md mx-auto px-4">
      {/* Progress indicator */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-[color:var(--color-muted)] mb-1">
          <span>
            {idx + 1} of {queue.length}
          </span>
          <button
            type="button"
            onClick={next}
            disabled={isPending || result.kind === "submitting"}
            className="hover:underline disabled:opacity-50"
          >
            Skip →
          </button>
        </div>
        <div className="h-1 bg-zinc-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[color:var(--color-gold)] transition-all"
            style={{ width: `${((idx + 1) / queue.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Product card */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-4 shadow-sm">
        <div className="text-center mb-4">
          <p className="text-xs uppercase tracking-wider text-[color:var(--color-muted)] mb-1">
            {current.category}
            {current.subcategory && ` · ${current.subcategory}`}
          </p>
          <h2 className="text-xl font-semibold leading-tight">
            {current.canonical_name}
          </h2>
          {current.brand && (
            <p className="text-sm text-[color:var(--color-muted)] mt-1">
              {current.brand}
            </p>
          )}
          {current.size_ml && (
            <p className="text-xs text-[color:var(--color-muted)] mt-1">
              {current.size_ml} ml
            </p>
          )}
        </div>

        {/* Current / uploaded image preview */}
        <div className="mb-4">
          {result.kind === "idle" && current.existing_image_url ? (
            <div className="aspect-square relative rounded-lg overflow-hidden border border-[color:var(--color-border)] bg-zinc-50">
              <Image
                src={current.existing_image_url}
                alt="Current photo (placeholder)"
                fill
                sizes="400px"
                className="object-contain opacity-60"
                unoptimized
              />
              <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-xs text-center py-1">
                Current: {current.existing_image_source ?? "none"} — replace me
              </div>
            </div>
          ) : result.kind !== "idle" ? (
            <div className="aspect-square relative rounded-lg overflow-hidden border border-[color:var(--color-border)] bg-zinc-50">
              <Image
                src={result.imageUrl}
                alt="Uploaded"
                fill
                sizes="400px"
                className="object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="aspect-square rounded-lg border border-dashed border-[color:var(--color-border)] bg-zinc-50 flex items-center justify-center">
              <span className="text-sm text-[color:var(--color-muted)]">
                No photo yet
              </span>
            </div>
          )}
        </div>

        {/* Action area */}
        {result.kind === "idle" && (
          <PhotoCapture
            storeId={storeId}
            catalogProductId={current.catalog_product_id}
            onUploaded={onUploaded}
          />
        )}

        {result.kind === "submitting" && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[color:var(--color-gold)] border-t-transparent" />
            <p className="text-sm text-[color:var(--color-muted)] mt-2">
              Checking photo…
            </p>
          </div>
        )}

        {result.kind === "confirm" && (
          <ConfirmPanel
            status={result.status}
            notes={result.notes}
            productLabel={
              current.brand
                ? `${current.brand} — ${current.canonical_name}`
                : current.canonical_name
            }
            onConfirm={onConfirm}
            onRetake={onRetake}
            isPending={isPending}
          />
        )}

        {result.kind === "rejected" && (
          <RejectedPanel notes={result.notes} onRetake={retryCurrent} />
        )}

        {result.kind === "saved" && (
          <SavedPanel appliedToCatalog={result.appliedToCatalog} />
        )}

        {/*
          Details editor — rendered below the photo area so the photo flow
          stays the primary interaction. Keyed on catalog_product_id so
          switching products resets the component (baselines reseed from the
          next product's props, panel re-collapses).
        */}
        {canEditDetails && (
          <div className="mt-4">
            <DetailsEdit
              key={current.catalog_product_id}
              inventoryId={current.inventory_id}
              initialDescription={current.inventory_description}
              initialTastingNotes={current.inventory_tasting_notes}
              catalogTastingNotes={current.catalog_tasting_notes}
            />
          </div>
        )}
      </div>

      <p className="text-center text-xs text-[color:var(--color-muted)] mt-4">
        Photos are auto-checked by AI, then confirmed by you before they hit
        the shared catalog.
        {canEditDetails
          ? " Tap “Edit details” to override the description or tasting notes for this product in your store."
          : " Description, tasting notes, and review editing land in the same flow in an upcoming release."}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

/**
 * Shown after upload + moderation, BEFORE advancing. The user verifies that
 * the photo they just took is actually of the product this screen is for.
 *
 * For flagged submissions we show a softer note ("our auto-checker wasn't
 * 100% sure — a manager will review after you confirm") but still let the
 * user proceed. The point of moderation is to catch abuse, not to gatekeep
 * benign unclear photos.
 */
function ConfirmPanel({
  status,
  notes,
  productLabel,
  onConfirm,
  onRetake,
  isPending,
}: {
  status: "approved" | "flagged";
  notes: string;
  productLabel: string;
  onConfirm: () => void;
  onRetake: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-sm font-medium">
          Does this photo show <span className="font-semibold">{productLabel}</span>?
        </p>
        {status === "flagged" && (
          <p className="text-xs text-amber-700 mt-2">
            Auto-check wasn&apos;t 100% sure — a manager will double-check
            after you confirm.
            {notes ? ` (${notes})` : ""}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onRetake}
          disabled={isPending}
          className="rounded-xl border border-[color:var(--color-border)] text-[color:var(--color-fg)] font-semibold py-4 hover:bg-zinc-50 disabled:opacity-50"
        >
          🔁 Retake
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className="rounded-xl bg-[color:var(--color-gold)] text-white font-semibold py-4 shadow-md active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          ✅ Yes, that&apos;s it
        </button>
      </div>
    </div>
  );
}

/** Moderation said no. Let the user try again without asking for confirmation. */
function RejectedPanel({
  notes,
  onRetake,
}: {
  notes: string;
  onRetake: () => void;
}) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-center space-y-3">
      <p className="text-2xl">⚠️</p>
      <p className="font-semibold text-red-900">Photo wasn&apos;t valid</p>
      <p className="text-xs text-red-700">{notes}</p>
      <button
        type="button"
        onClick={onRetake}
        className="mt-2 rounded-xl bg-[color:var(--color-gold)] text-white font-semibold py-3 px-6 shadow-md active:scale-[0.98] transition-transform"
      >
        📷 Try Again
      </button>
    </div>
  );
}

/** Brief confirmation before auto-advancing to the next product. */
function SavedPanel({ appliedToCatalog }: { appliedToCatalog: boolean }) {
  return (
    <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
      <p className="text-2xl mb-1">✅</p>
      <p className="font-semibold text-green-900">
        {appliedToCatalog ? "Saved — added to catalog" : "Saved"}
      </p>
      <p className="text-xs text-green-700 mt-1">Thank you! Next product…</p>
    </div>
  );
}
