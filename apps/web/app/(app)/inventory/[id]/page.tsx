import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ProductImage } from "@/components/ProductImage";
import { adjustStockAction, deleteItemAction } from "../item-actions";

type Item = {
  id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  size_ml: number | null;
  abv: number | null;
  price: number | null;
  cost: number | null;
  stock_qty: number;
  description: string | null;
  tasting_notes: string | null;
  image_url: string | null;
  image_source: string | null;
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
      "id, sku, name, brand, category, subcategory, size_ml, abv, price, cost, stock_qty, description, tasting_notes, image_url, image_source, is_active",
    )
    .eq("id", id)
    .maybeSingle()) as { data: Item | null };

  if (!item) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/inventory"
        className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
      >
        ← Inventory
      </Link>

      <div className="grid md:grid-cols-[260px_1fr] gap-6 items-start">
        <div className="space-y-2">
          <ProductImage
            src={item.image_url}
            alt={item.name}
            brand={item.brand}
            size="lg"
          />
          {item.image_source && (
            <p className="text-[10px] text-[color:var(--color-muted)] text-center capitalize">
              Image: {item.image_source.replace("openfoodfacts", "Open Food Facts")}
            </p>
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
            <Field label="Subcategory" value={item.subcategory ?? "—"} />
            <Field label="Size" value={item.size_ml ? `${item.size_ml}ml` : "—"} />
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
