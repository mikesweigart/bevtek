import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

type Item = {
  id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  size_ml: number | null;
  price: number | null;
  cost: number | null;
  stock_qty: number;
};

const PAGE_SIZE = 50;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page = "1" } = await searchParams;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  let query = supabase
    .from("inventory")
    .select("id, sku, name, brand, category, size_ml, price, cost, stock_qty", {
      count: "exact",
    })
    .order("name", { ascending: true })
    .range(from, to);

  const trimmed = q.trim();
  if (trimmed) {
    // Case-insensitive match on name, brand, or SKU.
    query = query.or(
      `name.ilike.%${trimmed}%,brand.ilike.%${trimmed}%,sku.ilike.%${trimmed}%`,
    );
  }

  const { data: items, count } = (await query) as {
    data: Item[] | null;
    count: number | null;
  };

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
        <Link
          href="/inventory/import"
          className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-4 py-2 text-sm font-medium whitespace-nowrap"
        >
          Import spreadsheet
        </Link>
      </div>

      <form className="flex gap-2" action="/inventory">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name, brand, or SKU"
          className="flex-1 rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]"
        />
        <button
          type="submit"
          className="rounded-md border border-[color:var(--color-border)] px-4 text-sm hover:border-[color:var(--color-fg)]"
        >
          Search
        </button>
      </form>

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
          <div className="rounded-lg border border-[color:var(--color-border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs text-[color:var(--color-muted)]">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Name</th>
                    <th className="text-left px-4 py-2 font-medium">Brand</th>
                    <th className="text-left px-4 py-2 font-medium">Category</th>
                    <th className="text-left px-4 py-2 font-medium">SKU</th>
                    <th className="text-right px-4 py-2 font-medium">Size</th>
                    <th className="text-right px-4 py-2 font-medium">Price</th>
                    <th className="text-right px-4 py-2 font-medium">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {(items ?? []).map((i) => (
                    <tr key={i.id} className="border-t border-[color:var(--color-border)]">
                      <td className="px-4 py-2">{i.name}</td>
                      <td className="px-4 py-2 text-[color:var(--color-muted)]">
                        {i.brand ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-[color:var(--color-muted)]">
                        {i.category ?? "—"}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-[color:var(--color-muted)]">
                        {i.sku ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-[color:var(--color-muted)]">
                        {i.size_ml ? `${i.size_ml}ml` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {i.price != null ? `$${Number(i.price).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[color:var(--color-muted)]">
                Page {pageNum} of {totalPages}
              </span>
              <div className="flex gap-2">
                {pageNum > 1 && (
                  <Link
                    href={`/inventory?${new URLSearchParams({ q, page: String(pageNum - 1) })}`}
                    className="rounded-md border border-[color:var(--color-border)] px-3 py-1.5 hover:border-[color:var(--color-fg)]"
                  >
                    Previous
                  </Link>
                )}
                {pageNum < totalPages && (
                  <Link
                    href={`/inventory?${new URLSearchParams({ q, page: String(pageNum + 1) })}`}
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
