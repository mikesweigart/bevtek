"use client";

import { useState, useMemo } from "react";

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

export function ProductGrid({
  products,
  storeSlug,
}: {
  products: Product[];
  storeSlug: string;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.category) set.add(p.category);
    return ["all", ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (filter !== "all") {
      list = list.filter((p) => p.category === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [products, filter, search]);

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--color-border)] p-12 text-center">
        <p className="text-sm text-[color:var(--color-muted)]">
          This store hasn&apos;t uploaded their inventory yet. Chat with Megan
          on the right — she can still help.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Search + filter */}
      <div className="mb-5 space-y-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search wines, spirits, beer..."
          className="w-full rounded-lg border border-[color:var(--color-border)] px-4 py-3 text-sm outline-none focus:border-[color:var(--color-gold)] bg-white"
        />
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === c
                  ? "bg-[color:var(--color-gold)] text-white border-[color:var(--color-gold)]"
                  : "border-[color:var(--color-border)] hover:border-[color:var(--color-gold)]"
              }`}
            >
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-[color:var(--color-muted)] mb-4">
        {filtered.length} product{filtered.length === 1 ? "" : "s"}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <article
            key={p.id}
            className="bg-white rounded-xl border border-[color:var(--color-border)] p-4 hover:border-[color:var(--color-gold)] transition-colors"
          >
            <div className="aspect-square rounded-lg bg-[#FBF7F0] mb-3 flex items-center justify-center overflow-hidden">
              {p.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <span className="text-3xl font-bold text-[color:var(--color-gold)]">
                  {(p.brand ?? p.name).slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            {p.brand && (
              <p className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)]">
                {p.brand}
              </p>
            )}
            <h3 className="text-sm font-semibold leading-tight mt-0.5 line-clamp-2 min-h-[2.5rem]">
              {p.name}
            </h3>
            <div className="flex items-end justify-between mt-3">
              {p.price != null ? (
                <span className="text-lg font-bold text-[color:var(--color-gold)]">
                  ${Number(p.price).toFixed(2)}
                </span>
              ) : (
                <span className="text-xs text-[color:var(--color-muted)]">
                  Ask in store
                </span>
              )}
              <span
                className={`text-[10px] ${
                  p.stock_qty <= 3 ? "text-amber-700 font-semibold" : "text-[color:var(--color-muted)]"
                }`}
              >
                {p.stock_qty <= 3 ? `Only ${p.stock_qty} left` : "In stock"}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
