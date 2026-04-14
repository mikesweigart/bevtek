import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ProductImage } from "@/components/ProductImage";

type Store = { id: string; name: string; slug: string };
type Item = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  size_ml: number | null;
  price: number | null;
  stock_qty: number;
  image_url: string | null;
};

const PAGE_SIZE = 48;

export default async function ShopperHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const { slug } = await params;
  const { q = "", category = "", page = "1" } = await searchParams;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const { data: store } = (await supabase
    .from("public_stores")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle()) as { data: Store | null };

  if (!store) notFound();

  // Build query
  let query = supabase
    .from("public_inventory")
    .select(
      "id, name, brand, category, subcategory, size_ml, price, stock_qty, image_url",
      { count: "exact" },
    )
    .eq("store_id", store.id)
    .eq("is_active", true)
    .gt("stock_qty", 0)
    .order("name", { ascending: true })
    .range(from, to);

  const qTrim = q.trim();
  if (qTrim) {
    query = query.or(
      `name.ilike.%${qTrim}%,brand.ilike.%${qTrim}%,category.ilike.%${qTrim}%`,
    );
  }
  if (category) {
    query = query.eq("category", category);
  }

  const { data: items, count } = (await query) as {
    data: Item[] | null;
    count: number | null;
  };

  // Distinct categories for the filter chips (fetched once; could cache later).
  const { data: categoryRows } = (await supabase
    .from("public_inventory")
    .select("category")
    .eq("store_id", store.id)
    .eq("is_active", true)
    .gt("stock_qty", 0)
    .not("category", "is", null)
    .limit(500)) as { data: { category: string | null }[] | null };

  const categories = Array.from(
    new Set(
      (categoryRows ?? [])
        .map((r) => r.category)
        .filter((c): c is string => !!c),
    ),
  )
    .sort()
    .slice(0, 12);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <form
        action={`/s/${store.slug}`}
        className="flex gap-2"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Search the store"
          className="flex-1 rounded-md border border-[color:var(--color-border)] px-4 py-3 text-base sm:text-sm outline-none focus:border-[color:var(--color-gold)]"
        />
        {category && <input type="hidden" name="category" value={category} />}
        <button
          type="submit"
          className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 text-sm font-medium"
        >
          Search
        </button>
      </form>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <CategoryChip
            href={`/s/${store.slug}${q ? `?q=${encodeURIComponent(q)}` : ""}`}
            active={!category}
          >
            All
          </CategoryChip>
          {categories.map((c) => {
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            params.set("category", c);
            return (
              <CategoryChip
                key={c}
                href={`/s/${store.slug}?${params}`}
                active={category === c}
              >
                {c}
              </CategoryChip>
            );
          })}
        </div>
      )}

      <div className="text-xs text-[color:var(--color-muted)]">
        {total.toLocaleString()} item{total === 1 ? "" : "s"} available
      </div>

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-[color:var(--color-border)] p-10 text-center">
          <p className="text-sm text-[color:var(--color-muted)]">
            Nothing matches your search.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
          {(items ?? []).map((item) => (
            <Link
              key={item.id}
              href={`/s/${store.slug}/p/${item.id}`}
              className="group rounded-lg border border-[color:var(--color-border)] p-3 hover:border-[color:var(--color-gold)] transition-colors flex flex-col gap-2"
            >
              <ProductImage
                src={item.image_url}
                alt={item.name}
                brand={item.brand}
                size="md"
              />
              <div className="flex flex-col gap-1 flex-1">
                {item.brand && (
                  <span className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)]">
                    {item.brand}
                  </span>
                )}
                <span className="text-sm font-medium leading-snug line-clamp-2">
                  {item.name}
                </span>
                <span className="flex items-baseline justify-between mt-auto pt-1 gap-2">
                  <span className="text-xs text-[color:var(--color-muted)]">
                    {item.size_ml ? `${item.size_ml}ml` : item.category}
                  </span>
                  {item.price != null && (
                    <span className="text-base font-semibold text-[color:var(--color-gold)]">
                      ${Number(item.price).toFixed(2)}
                    </span>
                  )}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm pt-4">
          <span className="text-[color:var(--color-muted)]">
            Page {pageNum} of {totalPages}
          </span>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <PageLink
                slug={store.slug}
                q={q}
                category={category}
                page={pageNum - 1}
              >
                Previous
              </PageLink>
            )}
            {pageNum < totalPages && (
              <PageLink
                slug={store.slug}
                q={q}
                category={category}
                page={pageNum + 1}
              >
                Next
              </PageLink>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-[color:var(--color-gold)] text-white border-[color:var(--color-gold)]"
          : "border-[color:var(--color-border)] hover:border-[color:var(--color-fg)]"
      }`}
    >
      {children}
    </Link>
  );
}

function PageLink({
  slug,
  q,
  category,
  page,
  children,
}: {
  slug: string;
  q: string;
  category: string;
  page: number;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  params.set("page", String(page));
  return (
    <Link
      href={`/s/${slug}?${params}`}
      className="rounded-md border border-[color:var(--color-border)] px-3 py-1.5 hover:border-[color:var(--color-fg)]"
    >
      {children}
    </Link>
  );
}
