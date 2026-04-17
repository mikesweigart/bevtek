import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ShopperChat } from "./ShopperChat";
import { ProductGrid } from "./ProductGrid";

// Customer-facing storefront at /shop/[slug]
// Example: /shop/grapes-and-grains
// No auth required — this is the public shopper experience.

type Store = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
};

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  price: number | null;
  stock_qty: number;
  image_url: string | null;
  description: string | null;
};

export default async function ShopperPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch store by slug (public-readable)
  const { data: storeData } = await supabase
    .from("stores")
    .select("id, name, slug, address, phone")
    .eq("slug", slug)
    .maybeSingle();

  const store = storeData as Store | null;
  if (!store) notFound();

  // Fetch featured inventory — top-stock items in each major category
  const { data: productData } = await supabase
    .from("inventory")
    .select("id, name, brand, category, price, stock_qty, image_url, description")
    .eq("store_id", store.id)
    .eq("is_active", true)
    .gt("stock_qty", 0)
    .order("stock_qty", { ascending: false })
    .limit(24);

  const products = (productData as Product[] | null) ?? [];

  return (
    <div className="min-h-screen bg-[#FBF7F0]">
      {/* Store header */}
      <header className="bg-white border-b border-[color:var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)]">
              Powered by BevTek.ai
            </p>
            <h1 className="text-2xl font-semibold tracking-tight mt-0.5">
              {store.name}
            </h1>
            {store.address && (
              <p className="text-xs text-[color:var(--color-muted)] mt-1">
                {store.address}
                {store.phone && ` · ${store.phone}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[color:var(--color-gold)] flex items-center justify-center text-white font-bold">
              G
            </div>
            <div>
              <p className="text-xs font-semibold">Gabby</p>
              <p className="text-[10px] text-[color:var(--color-muted)]">
                Your beverage expert
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Left: product discovery */}
        <section>
          <div className="mb-6">
            <h2 className="text-3xl font-semibold tracking-tight">
              What&apos;s your evening looking like?
            </h2>
            <p className="text-sm text-[color:var(--color-muted)] mt-2">
              Chat with Gabby for a personal recommendation, or browse our
              shelves below.
            </p>
          </div>

          <ProductGrid products={products} storeSlug={store.slug} />
        </section>

        {/* Right: Gabby chat */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <ShopperChat storeId={store.id} storeName={store.name} />
        </aside>
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-8 text-center">
        <p className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)]">
          {store.name} · Powered by BevTek.ai
        </p>
      </footer>
    </div>
  );
}
