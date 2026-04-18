// Featured row on the customer-facing shop page. Renders store-featured
// and national-sponsored products side by side — customers don't see the
// distinction, but national promos display a small "Sponsored" marker per
// FTC rules. Runs off the active_promotions_for_store() RPC which already
// joins the inventory row and filters out stale/out-of-stock matches.

import Link from "next/link";
import { ProductImage } from "@/components/ProductImage";

export type FeaturedItem = {
  id: string;
  kind: "store" | "national";
  title: string;
  tagline: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  priority: number;
  inventory_id: string;
  inventory_name: string;
  inventory_price: number | null;
  inventory_image_url: string | null;
  inventory_stock_qty: number;
  inventory_brand: string | null;
  inventory_varietal: string | null;
  inventory_summary: string | null;
};

export function FeaturedRow({
  items,
  storeSlug,
}: {
  items: FeaturedItem[];
  storeSlug: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-xl font-semibold tracking-tight">Featured</h3>
        <p className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)]">
          Hand-picked for you
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.slice(0, 8).map((f) => (
          <Link
            key={f.id}
            href={f.cta_url ?? `/shop/${storeSlug}/p/${f.inventory_id}`}
            className="group rounded-xl border border-[color:var(--color-border)] bg-white overflow-hidden hover:border-[color:var(--color-gold)] transition-colors"
          >
            <div className="aspect-square bg-zinc-50 relative">
              <ProductImage
                src={f.image_url ?? f.inventory_image_url}
                alt={f.title}
                brand={f.inventory_brand}
                size="lg"
              />
              {/* FTC-required sponsorship marker for national promos. */}
              {f.kind === "national" && (
                <span className="absolute top-2 right-2 text-[9px] tracking-widest uppercase font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white">
                  Sponsored
                </span>
              )}
            </div>
            <div className="p-3">
              <p className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)] truncate">
                {f.inventory_brand ?? ""}
                {f.inventory_varietal ? ` · ${f.inventory_varietal}` : ""}
              </p>
              <p className="font-semibold text-sm line-clamp-2 leading-snug mt-0.5">
                {f.title}
              </p>
              {f.tagline && (
                <p className="text-xs text-[color:var(--color-muted)] line-clamp-2 mt-1 italic">
                  {f.tagline}
                </p>
              )}
              <p className="text-sm font-semibold text-[color:var(--color-gold)] mt-2">
                {f.inventory_price != null
                  ? `$${Number(f.inventory_price).toFixed(2)}`
                  : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
