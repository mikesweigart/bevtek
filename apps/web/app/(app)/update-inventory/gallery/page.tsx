/**
 * Update Inventory manager gallery — moderation review queue.
 *
 * Server component, manager-only. Shows every submission from this store
 * (pending, approved, flagged, rejected) with:
 *   - The submitted photo
 *   - The target product
 *   - Who uploaded it and when
 *   - Moderation status + AI reasoning
 *   - Reject button (manager)
 *   - Revoke/restore upload privilege (manager)
 *
 * The gallery also anchors the "Layer 5" safeguard from the approved v1
 * moderation stack — even if automated moderation misses something, a
 * manager can pull it back within one click.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { GalleryRow } from "./GalleryRow";
import { PrivilegeRowClient } from "./PrivilegeRowClient";

export default async function UpdateInventoryGalleryPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.store_id || !profile.role) redirect("/login");

  const isManager = profile.role === "owner" || profile.role === "manager";
  if (!isManager) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <p className="text-2xl mb-2">🔒</p>
        <h1 className="text-xl font-semibold">Managers only</h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-2">
          Ask an owner or manager to show you the gallery.
        </p>
      </div>
    );
  }

  const [submissionsRes, staffRes] = await Promise.all([
    supabase
      .from("catalog_image_submissions")
      .select(
        "id, catalog_product_id, image_url, moderation_status, moderation_notes, applied_to_catalog_at, rejected_at, created_at, submitted_by",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("users")
      .select("id, full_name, email, role, photo_upload_privilege"),
  ]);

  type Submission = {
    id: string;
    catalog_product_id: string;
    image_url: string;
    moderation_status: "pending" | "approved" | "flagged" | "rejected";
    moderation_notes: string | null;
    applied_to_catalog_at: string | null;
    rejected_at: string | null;
    created_at: string;
    submitted_by: string;
  };

  type StaffMember = {
    id: string;
    full_name: string | null;
    email: string;
    role: "owner" | "manager" | "staff";
    photo_upload_privilege: boolean;
  };

  const submissions = (submissionsRes.data ?? []) as unknown as Submission[];
  const staff = (staffRes.data ?? []) as unknown as StaffMember[];

  // Batch-fetch the target product names.
  const productIds = Array.from(
    new Set(submissions.map((s) => s.catalog_product_id)),
  );
  const { data: productsRes } =
    productIds.length > 0
      ? await supabase
          .from("catalog_products")
          .select("id, canonical_name, brand")
          .in("id", productIds)
      : { data: [] as Array<{ id: string; canonical_name: string; brand: string | null }> };

  type Product = { id: string; canonical_name: string; brand: string | null };
  const products = (productsRes ?? []) as unknown as Product[];
  const productMap = new Map(products.map((p) => [p.id, p]));
  const staffMap = new Map(staff.map((s) => [s.id, s]));

  const pending = submissions.filter((s) =>
    ["pending", "flagged"].includes(s.moderation_status),
  );
  const approved = submissions.filter((s) => s.moderation_status === "approved");
  const rejected = submissions.filter((s) => s.moderation_status === "rejected");

  const uploaders = staff.filter((s) => s.role === "staff");

  return (
    <div className="space-y-10">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Update Inventory gallery
          </h1>
          <p className="text-sm text-[color:var(--color-muted)] mt-1">
            Review, reject, and manage update privileges.
          </p>
        </div>
        <Link
          href="/update-inventory"
          className="text-sm text-[color:var(--color-gold)] hover:underline"
        >
          ← Start a session
        </Link>
      </header>

      <section>
        <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)] mb-4">
          Needs review ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted)]">
            Nothing waiting. All caught up.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((s) => (
              <GalleryRow
                key={s.id}
                submission={s}
                product={productMap.get(s.catalog_product_id) ?? null}
                submitter={staffMap.get(s.submitted_by) ?? null}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)] mb-4">
          Approved ({approved.length})
        </h2>
        {approved.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted)]">
            No approved submissions yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {approved.slice(0, 12).map((s) => (
              <GalleryRow
                key={s.id}
                submission={s}
                product={productMap.get(s.catalog_product_id) ?? null}
                submitter={staffMap.get(s.submitted_by) ?? null}
              />
            ))}
          </div>
        )}
      </section>

      {rejected.length > 0 && (
        <section>
          <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)] mb-4">
            Rejected ({rejected.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rejected.slice(0, 12).map((s) => (
              <GalleryRow
                key={s.id}
                submission={s}
                product={productMap.get(s.catalog_product_id) ?? null}
                submitter={staffMap.get(s.submitted_by) ?? null}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium tracking-widest uppercase text-[color:var(--color-muted)] mb-4">
          Staff update access
        </h2>
        {uploaders.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted)]">
            No staff on this store yet.
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--color-border)] border border-[color:var(--color-border)] rounded-lg">
            {uploaders.map((s) => (
              <li key={s.id} className="p-4">
                <PrivilegeRowClient
                  userId={s.id}
                  name={s.full_name ?? s.email}
                  email={s.email}
                  privilege={s.photo_upload_privilege}
                />
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-[color:var(--color-muted)] mt-3">
          Owners and managers always have update access and are not listed here.
        </p>
      </section>
    </div>
  );
}
