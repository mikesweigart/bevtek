import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { ProductImage } from "@/components/ProductImage";
import { HoldButton } from "./HoldButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("public_stores")
    .select("name")
    .eq("slug", slug)
    .maybeSingle();
  const { data: item } = await supabase
    .from("public_inventory")
    .select("name, brand, description, image_url, price")
    .eq("id", id)
    .maybeSingle();
  const s = store as { name: string } | null;
  const i = item as
    | {
        name: string;
        brand: string | null;
        description: string | null;
        image_url: string | null;
        price: number | null;
      }
    | null;
  if (!s || !i) return { title: "Not found" };
  const title = i.brand ? `${i.brand} · ${i.name}` : i.name;
  const desc =
    i.description ??
    `${i.price != null ? `$${Number(i.price).toFixed(2)} · ` : ""}${s.name}`;
  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      images: i.image_url ? [{ url: i.image_url }] : undefined,
    },
  };
}

type Store = { id: string; name: string; slug: string };
type Item = {
  id: string;
  store_id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  size_ml: number | null;
  abv: number | null;
  price: number | null;
  stock_qty: number;
  description: string | null;
  tasting_notes: string | null;
  image_url: string | null;
  image_source: string | null;
};

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const supabase = await createClient();

  const { data: store } = (await supabase
    .from("public_stores")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle()) as { data: Store | null };

  if (!store) notFound();

  const { data: item } = (await supabase
    .from("public_inventory")
    .select(
      "id, store_id, sku, name, brand, category, subcategory, size_ml, abv, price, stock_qty, description, tasting_notes, image_url, image_source",
    )
    .eq("id", id)
    .eq("store_id", store.id)
    .eq("is_active", true)
    .maybeSingle()) as { data: Item | null };

  if (!item) notFound();

  const inStock = item.stock_qty > 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href={`/s/${store.slug}`}
        className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
      >
        ← Back to {store.name}
      </Link>

      <div className="grid md:grid-cols-[300px_1fr] gap-6 md:gap-8 items-start">
        <div className="space-y-2">
          <ProductImage
            src={item.image_url}
            alt={item.name}
            brand={item.brand}
            size="lg"
          />
          {item.image_source === "wikipedia" && (
            <p className="text-[10px] text-[color:var(--color-muted)] text-center">
              Sample image · Wikipedia
            </p>
          )}
          {item.image_source === "openfoodfacts" && (
            <p className="text-[10px] text-[color:var(--color-muted)] text-center">
              Image · Open Food Facts
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            {item.brand && (
              <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
                {item.brand}
              </p>
            )}
            <h1 className="text-3xl font-semibold tracking-tight leading-tight">
              {item.name}
            </h1>
            <div className="flex flex-wrap gap-x-3 text-xs text-[color:var(--color-muted)]">
              {item.category && <span>{item.category}</span>}
              {item.subcategory && <span>· {item.subcategory}</span>}
              {item.size_ml && <span>· {item.size_ml}ml</span>}
              {item.abv != null && <span>· {item.abv}% ABV</span>}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            {item.price != null && (
              <span className="text-3xl font-semibold text-[color:var(--color-gold)]">
                ${Number(item.price).toFixed(2)}
              </span>
            )}
            <span
              className={`text-xs px-3 py-1 rounded-full ${
                inStock
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {inStock ? "In stock" : "Out of stock"}
            </span>
          </div>

          {inStock && (
            <div className="pt-2">
              <HoldButton
                storeSlug={slug}
                itemId={item.id}
                itemName={item.name}
              />
            </div>
          )}
        </div>
      </div>

      {item.description && (
        <section className="pt-4 border-t border-[color:var(--color-border)]">
          <h2 className="text-xs tracking-widest uppercase text-[color:var(--color-muted)] mb-2">
            About
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

      {item.sku && (
        <p className="text-xs text-[color:var(--color-muted)] pt-4 border-t border-[color:var(--color-border)] font-mono">
          SKU: {item.sku}
        </p>
      )}
    </div>
  );
}
