import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { EnrichButton } from "./EnrichButton";
import { EnrichFullButton } from "./EnrichFullButton";
import { NormalizeNamesButton } from "./NormalizeNamesButton";
import { ProductImage } from "@/components/ProductImage";

type Item = {
  id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  varietal: string | null;
  category: string | null;
  size_ml: number | null;
  price: number | null;
  cost: number | null;
  stock_qty: number;
  image_url: string | null;
  image_source: string | null;
  source_confidence: string | null;
  is_active: boolean;
};

const PAGE_SIZE = 50;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; category?: string }>;
}) {
  const { q = "", page = "1", category = "" } = await searchParams;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  let query = supabase
    .from("inventory")
    .select(
      "id, sku, name, brand, varietal, category, size_ml, price, cost, stock_qty, image_url, image_source, source_confidence, is_active",
      {
        count: "exact",
      },
    )
    .order("category", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })
    .range(from, to);

  const trimmed = q.trim();
  if (trimmed) {
    query = query.or(
      `name.ilike.%${trimmed}%,brand.ilike.%${trimmed}%,sku.ilike.%${trimmed}%`,
    );
  }
  if (category) {
    query = query.eq("category", category);
  }

  const { data: items, count } = (await query) as {
    data: Item[] | null;
    count: number | null;
  };

  // Pull the category index (name + count) once so we can render filter
  // chips at the top. Cheap query: just category column, distinct via JS.
  const { data: catRows } = await supabase
    .from("inventory")
    .select("category")
    .not("category", "is", null);
  const catCounts = new Map<string, number>();
  for (const r of (catRows ?? []) as { category: string | null }[]) {
    if (!r.category) continue;
    catCounts.set(r.category, (catCounts.get(r.category) ?? 0) + 1);
  }
  const categoryList = Array.from(catCounts.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  // Group items under category headings for the visual "by category" view.
  const grouped = new Map<string, Item[]>();
  for (const i of items ?? []) {
    const key = i.category || "Uncategorized";
    const arr = grouped.get(key) ?? [];
    arr.push(i);
    grouped.set(key, arr);
  }
  const groupedList = Array.from(grouped.entries());

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            {total.toLocaleString()} item{total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/inventory/new"
            className="rounded-md border border-[color:var(--color-border)] hover:border-[color:var(--color-fg)] px-4 py-2 text-sm font-medium whitespace-nowrap"
          >
            New item
          </Link>
          <Link
            href="/inventory/import"
            className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-4 py-2 text-sm font-medium whitespace-nowrap"
          >
            Import
          </Link>
        </div>
      </div>

      <form className="flex gap-2" action="/inventory">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name, brand, or SKU"
          className="flex-1 rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]"
        />
        {category && (
          <input type="hidden" name="category" value={category} />
        )}
        <button
          type="submit"
          className="rounded-md border border-[color:var(--color-border)] px-4 text-sm hover:border-[color:var(--color-fg)]"
        >
          Search
        </button>
      </form>

      {categoryList.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/inventory${q ? `?q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full text-xs px-3 py-1.5 border ${
              !category
                ? "bg-[color:var(--color-gold)] text-white border-[color:var(--color-gold)]"
                : "border-[color:var(--color-border)] hover:border-[color:var(--color-fg)]"
            }`}
          >
            All <span className="opacity-75 ml-1">{total}</span>
          </Link>
          {categoryList.map(([cat, n]) => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            params.set("category", cat);
            const active = category === cat;
            return (
              <Link
                key={cat}
                href={`/inventory?${params.toString()}`}
                className={`rounded-full text-xs px-3 py-1.5 border ${
                  active
                    ? "bg-[color:var(--color-gold)] text-white border-[color:var(--color-gold)]"
                    : "border-[color:var(--color-border)] hover:border-[color:var(--color-fg)]"
                }`}
              >
                {cat} <span className="opacity-75 ml-1">{n}</span>
              </Link>
            );
          })}
        </div>
      )}

      {total > 0 && (
        <div className="flex flex-col gap-3">
          <NormalizeNamesButton />
          <EnrichFullButton />
          <EnrichButton />
        </div>
      )}

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-[color:var(--color-border)] p-10 text-center">
          <p className="text-sm text-[color:var(--color-muted)]">
            No items yet.
          </p>
          <Link
            href="/inventory/import"
            className="inline-block mt-3 text-sm text-[color:var(--color-gold)] underline"
          >
            Import your first spreadsheet →
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {groupedList.map(([cat, catItems]) => (
              <div
                key={cat}
                className="rounded-lg border border-[color:var(--color-border)] overflow-hidden"
              >
                <div className="bg-zinc-50 px-4 py-2.5 flex items-baseline justify-between border-b border-[color:var(--color-border)]">
                  <h3 className="text-xs font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
                    {cat}
                  </h3>
                  <span className="text-[10px] text-[color:var(--color-muted)]">
                    {catItems.length} item{catItems.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {catItems.map((i) => (
                        <tr
                          key={i.id}
                          className="border-t border-[color:var(--color-border)] first:border-t-0 hover:bg-zinc-50/60"
                        >
                          <td className="px-4 py-2 w-16">
                            <Link
                              href={`/inventory/${i.id}`}
                              className="block w-10 h-10"
                              aria-label={`View ${i.name}`}
                            >
                              <ProductImage
                                src={i.image_url}
                                alt={i.name}
                                brand={i.brand}
                                size="sm"
                              />
                            </Link>
                          </td>
                          <td className="px-4 py-2">
                            <Link
                              href={`/inventory/${i.id}`}
                              className="block hover:text-[color:var(--color-gold)]"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{i.name}</span>
                                {i.source_confidence && (
                                  <RowConfidencePill
                                    value={i.source_confidence}
                                    source={i.image_source}
                                  />
                                )}
                              </div>
                              {(i.brand || i.varietal) && (
                                <div className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)]">
                                  {[i.brand, i.varietal]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </div>
                              )}
                            </Link>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-[color:var(--color-muted)]">
                            {i.sku ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {i.price != null ? `$${Number(i.price).toFixed(2)}` : "—"}
                          </td>
                          <td className="px-4 py-2 text-right w-20">
                            <span
                              className={
                                i.stock_qty <= 0
                                  ? "text-red-600"
                                  : i.stock_qty < 5
                                    ? "text-amber-600"
                                    : ""
                              }
                            >
                              {i.stock_qty}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[color:var(--color-muted)]">
                Page {pageNum} of {totalPages}
              </span>
              <div className="flex gap-2">
                {pageNum > 1 && (
                  <Link
                    href={`/inventory?${new URLSearchParams({ q, category, page: String(pageNum - 1) })}`}
                    className="rounded-md border border-[color:var(--color-border)] px-3 py-1.5 hover:border-[color:var(--color-fg)]"
                  >
                    Previous
                  </Link>
                )}
                {pageNum < totalPages && (
                  <Link
                    href={`/inventory?${new URLSearchParams({ q, category, page: String(pageNum + 1) })}`}
                    className="rounded-md border border-[color:var(--color-border)] px-3 py-1.5 hover:border-[color:var(--color-fg)]"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Tiny inline badge on each inventory row so the owner can eyeball
 * which products came back from which tier of the pipeline. Green =
 * verified/high (external provider match), amber = medium/low (name
 * search / AI-generated), red = placeholder fallback, gray = none.
 * Hover title spells out the exact image source.
 */
function RowConfidencePill({
  value,
  source,
}: {
  value: string;
  source: string | null;
}) {
  const colorMap: Record<string, string> = {
    verified: "bg-emerald-500",
    high: "bg-emerald-400",
    medium: "bg-amber-400",
    low: "bg-amber-500",
    partial: "bg-zinc-400",
    none: "bg-red-400",
  };
  const color = colorMap[value] ?? "bg-zinc-300";
  const title = `Confidence: ${value}${source ? ` · image from ${source}` : ""}`;
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${color}`}
      title={title}
      aria-label={title}
    />
  );
}
