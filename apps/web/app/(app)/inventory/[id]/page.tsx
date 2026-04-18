import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ProductImage } from "@/components/ProductImage";
import { adjustStockAction, deleteItemAction } from "../item-actions";
import { reenrichSingleAction } from "../actions";
import { FeatureProductButton } from "./FeatureProductButton";
import { endPromotionAction } from "@/app/(app)/promotions/actions";

type Item = {
  id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  varietal: string | null;
  category: string | null;
  subcategory: string | null;
  size_ml: number | null;
  size_label: string | null;
  abv: number | null;
  price: number | null;
  cost: number | null;
  stock_qty: number;
  description: string | null;
  tasting_notes: string | null;
  summary_for_customer: string | null;
  source_confidence: string | null;
  image_url: string | null;
  image_source: string | null;
  enriched_at: string | null;
  is_active: boolean;
};

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user!.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  const isManager = role === "owner" || role === "manager";

  const { data: item } = (await supabase
    .from("inventory")
    .select(
      "id, sku, name, brand, varietal, category, subcategory, size_ml, size_label, abv, price, cost, stock_qty, description, tasting_notes, summary_for_customer, source_confidence, image_url, image_source, enriched_at, is_active",
    )
    .eq("id", id)
    .maybeSingle()) as { data: Item | null };

  if (!item) notFound();

  // Is this product currently featured? One query — RLS scopes to the
  // owner's store automatically. We surface it as a gold strip above
  // the main info block when present.
  const { data: activePromo } = await supabase
    .from("promotions")
    .select("id, title, tagline, ends_at")
    .eq("inventory_id", id)
    .eq("kind", "store")
    .eq("status", "active")
    .gte("ends_at", new Date().toISOString())
    .order("ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const promo = activePromo as
    | { id: string; title: string; tagline: string | null; ends_at: string }
    | null;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/inventory"
        className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
      >
        ← Inventory
      </Link>

      {promo && (
        <div className="rounded-lg border border-[color:var(--color-gold)] bg-[color:var(--color-gold)]/10 px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-semibold text-[color:var(--color-fg)]">
              ★ Featured: {promo.title}
            </p>
            <p className="text-xs text-[color:var(--color-muted)]">
              Ends {new Date(promo.ends_at).toLocaleDateString()}
            </p>
          </div>
          {isManager && (
            <form action={endPromotionAction}>
              <input type="hidden" name="id" value={promo.id} />
              <button
                type="submit"
                className="text-xs text-red-600 hover:underline"
              >
                End early
              </button>
            </form>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-[260px_1fr] gap-6 items-start">
        <div className="space-y-2">
          <ProductImage
            src={item.image_url}
            alt={item.name}
            brand={item.brand}
            size="lg"
          />
          {item.image_source && (
            <p className="text-[10px] text-[color:var(--color-muted)] text-center">
              Image: {formatSource(item.image_source)}
            </p>
          )}
          {item.source_confidence && (
            <p className="text-[10px] text-center">
              <ConfidenceBadge value={item.source_confidence} />
            </p>
          )}
          {isManager && (
            <form action={reenrichSingleAction}>
              <input type="hidden" name="id" value={item.id} />
              <button
                type="submit"
                className="w-full rounded-md border border-[color:var(--color-border)] px-3 py-1.5 text-xs hover:border-[color:var(--color-fg)]"
                title="Re-run the image + tasting-notes pipeline for this product"
              >
                ↻ Re-enrich
              </button>
            </form>
          )}

          {isManager && (
            <FeatureProductButton
              inventoryId={item.id}
              defaultTitle={promo?.title ?? item.name}
              defaultTagline={
                promo?.tagline ??
                item.summary_for_customer ??
                item.tasting_notes
              }
              currentlyFeatured={!!promo}
            />
          )}
        </div>

        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              {item.brand && (
                <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
                  {item.brand}
                </p>
              )}
              <h1 className="text-2xl font-semibold tracking-tight">
                {item.name}
              </h1>
              {!item.is_active && (
                <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-zinc-100 text-[color:var(--color-muted)] uppercase tracking-widest">
                  Hidden from customers
                </span>
              )}
            </div>
            {isManager && (
              <Link
                href={`/inventory/${item.id}/edit`}
                className="rounded-md border border-[color:var(--color-border)] px-3 py-1.5 text-sm hover:border-[color:var(--color-fg)]"
              >
                Edit
              </Link>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Field label="Price" value={item.price != null ? `$${Number(item.price).toFixed(2)}` : "—"} />
            <Field label="Cost" value={item.cost != null ? `$${Number(item.cost).toFixed(2)}` : "—"} />
            <Field label="Category" value={item.category ?? "—"} />
            <Field label="Varietal" value={item.varietal ?? "—"} />
            <Field label="Subcategory" value={item.subcategory ?? "—"} />
            <Field
              label="Size"
              value={
                item.size_label ??
                (item.size_ml ? `${item.size_ml}ml` : "—")
              }
            />
            <Field label="ABV" value={item.abv != null ? `${item.abv}%` : "—"} />
            <Field label="SKU" value={item.sku ?? "—"} mono />
          </dl>

          {isManager && (
            <div className="flex items-center gap-2">
              <form action={adjustStockAction}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="delta" value="-1" />
                <button
                  type="submit"
                  disabled={item.stock_qty <= 0}
                  className="rounded-md border border-[color:var(--color-border)] w-8 h-8 text-sm hover:border-[color:var(--color-fg)] disabled:opacity-40"
                >
                  −
                </button>
              </form>
              <span className="text-lg font-semibold w-12 text-center">
                {item.stock_qty}
              </span>
              <form action={adjustStockAction}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="delta" value="1" />
                <button
                  type="submit"
                  className="rounded-md border border-[color:var(--color-border)] w-8 h-8 text-sm hover:border-[color:var(--color-fg)]"
                >
                  +
                </button>
              </form>
              <span className="text-xs text-[color:var(--color-muted)] ml-1">
                in stock
              </span>
            </div>
          )}
        </div>
      </div>

      {item.description && (
        <section className="pt-4 border-t border-[color:var(--color-border)]">
          <h2 className="text-xs tracking-widest uppercase text-[color:var(--color-muted)] mb-2">
            Description
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {item.description}
          </p>
        </section>
      )}

      {item.tasting_notes && (
        <section className="pt-4 border-t border-[color:var(--color-border)]">
          <h2 className="text-xs tracking-widest uppercase text-[color:var(--color-muted)] mb-2">
            Tasting notes
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {item.tasting_notes}
          </p>
        </section>
      )}

      {item.summary_for_customer && (
        <section className="pt-4 border-t border-[color:var(--color-border)]">
          <h2 className="text-xs tracking-widest uppercase text-[color:var(--color-muted)] mb-2">
            What Gabby will say
          </h2>
          <p className="text-sm leading-relaxed italic text-[color:var(--color-fg)]">
            “{item.summary_for_customer}”
          </p>
          <p className="text-[10px] text-[color:var(--color-muted)] mt-2">
            This is the short pitch Gabby uses when recommending the product to a
            customer. Edit the tasting-notes field above to influence it, or click
            Re-enrich to regenerate from the source.
          </p>
        </section>
      )}

      {item.enriched_at && (
        <p className="text-[10px] text-[color:var(--color-muted)]">
          Last enriched {new Date(item.enriched_at).toLocaleString()}
        </p>
      )}

      {isManager && (
        <form
          action={deleteItemAction}
          className="pt-6 border-t border-[color:var(--color-border)]"
        >
          <input type="hidden" name="id" value={item.id} />
          <button
            type="submit"
            className="text-sm text-red-600 hover:underline"
          >
            Delete item
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * Human label for the `image_source` / `tasting_notes_source` strings.
 * Keep in sync with lib/enrichment/types.ts — these come straight out
 * of the enrichment pipeline.
 */
function formatSource(src: string): string {
  const map: Record<string, string> = {
    cache: "Cached (from another store)",
    open_food_facts: "Open Food Facts",
    openfoodfacts: "Open Food Facts",
    wikipedia: "Wikipedia",
    producer_site: "Producer site",
    retail_site: "Retailer (Total Wine / ReserveBar / Wine.com)",
    generated: "AI-generated",
    placeholder: "Placeholder (no source found)",
    manual: "Manual upload",
  };
  return map[src] ?? src;
}

/**
 * Colored pill for `source_confidence`. Verified = cross-provider agreement,
 * high = UPC-level match, medium = name match, low = fuzzy, partial = one
 * of image/notes present, none = nothing worked. Matches the tiering in
 * lib/enrichment/confidence.ts.
 */
function ConfidenceBadge({ value }: { value: string }) {
  const styles: Record<string, string> = {
    verified: "bg-emerald-100 text-emerald-800",
    high: "bg-emerald-50 text-emerald-700",
    medium: "bg-amber-50 text-amber-700",
    low: "bg-amber-100 text-amber-800",
    partial: "bg-zinc-100 text-zinc-700",
    none: "bg-red-50 text-red-700",
  };
  const cls = styles[value] ?? "bg-zinc-100 text-zinc-700";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded uppercase tracking-widest text-[9px] font-semibold ${cls}`}
    >
      {value}
    </span>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <>
      <dt className="text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
        {label}
      </dt>
      <dd className={mono ? "font-mono text-xs" : ""}>{value}</dd>
    </>
  );
}
