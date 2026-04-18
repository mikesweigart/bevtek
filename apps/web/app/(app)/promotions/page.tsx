// Owner-facing promotions dashboard. Two sections:
//   1. Your featured items — store-kind promos the owner created via the
//      "Feature this product" button on an inventory detail page.
//   2. Sponsored national campaigns — auto-shown by default (per product
//      decision), with a one-click opt-out per campaign.
//
// Store-kind and national-kind live in the same `promotions` table; we
// split them here so owners can reason about the two revenue streams
// separately (their own merchandising vs. supplier-paid placements).

import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { ProductImage } from "@/components/ProductImage";
import {
  endPromotionAction,
  optOutOfNationalPromoAction,
} from "./actions";

type StorePromo = {
  id: string;
  title: string;
  tagline: string | null;
  starts_at: string;
  ends_at: string;
  inventory_id: string;
  inventory_name: string | null;
  inventory_brand: string | null;
  inventory_image_url: string | null;
  inventory_price: number | null;
};

type NationalPromo = {
  id: string;
  title: string;
  tagline: string | null;
  brand: string | null;
  category: string | null;
  starts_at: string;
  ends_at: string;
  store_revenue_share_pct: number;
  opted_out: boolean;
  matched_inventory_id: string | null;
  matched_inventory_name: string | null;
  matched_inventory_image_url: string | null;
};

export default async function PromotionsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return (
      <p className="text-sm text-[color:var(--color-muted)]">
        Sign in to manage promotions.
      </p>
    );
  }

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = profile as { store_id?: string; role?: string } | null;
  const storeId = p?.store_id ?? null;
  const role = p?.role ?? null;
  const isManager = role === "owner" || role === "manager";
  if (!storeId) {
    return (
      <p className="text-sm text-[color:var(--color-muted)]">
        No store associated with your account.
      </p>
    );
  }

  // Section 1 — this store's own featured items. Inline-join the
  // inventory row for each so we can render the thumbnail.
  const { data: storeRows } = await supabase
    .from("promotions")
    .select(
      "id, title, tagline, starts_at, ends_at, inventory_id, inventory:inventory_id ( id, name, brand, image_url, price )",
    )
    .eq("store_id", storeId)
    .eq("kind", "store")
    .eq("status", "active")
    .gte("ends_at", new Date().toISOString())
    .order("ends_at", { ascending: true });

  // supabase-js returns the joined relation as an array even when the FK
  // is single-valued; we take the first element.
  type InvRel = {
    id: string;
    name: string;
    brand: string | null;
    image_url: string | null;
    price: number | null;
  };
  const storePromos: StorePromo[] = (
    (storeRows ?? []) as unknown as Array<{
      id: string;
      title: string;
      tagline: string | null;
      starts_at: string;
      ends_at: string;
      inventory_id: string;
      inventory: InvRel | InvRel[] | null;
    }>
  ).map((r) => {
    const inv = Array.isArray(r.inventory) ? r.inventory[0] ?? null : r.inventory;
    return {
      id: r.id,
      title: r.title,
      tagline: r.tagline,
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      inventory_id: r.inventory_id,
      inventory_name: inv?.name ?? null,
      inventory_brand: inv?.brand ?? null,
      inventory_image_url: inv?.image_url ?? null,
      inventory_price: inv?.price ?? null,
    };
  });

  // Section 2 — national campaigns targeting this store. We need to show
  // BOTH active-and-showing and active-but-opted-out so owners can see
  // what they've dismissed. Use the raw promotions table (not the RPC)
  // because the RPC filters opt-outs out entirely.
  const { data: nationalRows } = await supabase
    .from("promotions")
    .select(
      "id, title, tagline, brand, category, upc, starts_at, ends_at, store_revenue_share_pct, target_store_ids",
    )
    .eq("kind", "national")
    .eq("status", "active")
    .gte("ends_at", new Date().toISOString())
    .order("ends_at", { ascending: true });

  // Filter to ones that target this store (null target_store_ids means all).
  const nationals = (
    (nationalRows ?? []) as Array<{
      id: string;
      title: string;
      tagline: string | null;
      brand: string | null;
      category: string | null;
      upc: string | null;
      starts_at: string;
      ends_at: string;
      store_revenue_share_pct: number;
      target_store_ids: string[] | null;
    }>
  ).filter(
    (n) =>
      n.target_store_ids === null || n.target_store_ids.includes(storeId),
  );

  // Which have we opted out of?
  const { data: optOuts } = await supabase
    .from("promotion_opt_outs")
    .select("promotion_id")
    .eq("store_id", storeId);
  const optedOutSet = new Set(
    ((optOuts ?? []) as { promotion_id: string }[]).map((o) => o.promotion_id),
  );

  // Resolve matching inventory for each national — by UPC, then brand,
  // then category. Skip nationals that have no in-store match (RPC logic
  // mirrored client-side so opted-out ones still render properly).
  const nationalPromos: NationalPromo[] = [];
  for (const n of nationals) {
    let matchQuery = supabase
      .from("inventory")
      .select("id, name, image_url")
      .eq("store_id", storeId)
      .gt("stock_qty", 0)
      .limit(1);
    if (n.upc) matchQuery = matchQuery.eq("upc", n.upc);
    else if (n.brand) matchQuery = matchQuery.ilike("brand", n.brand);
    else if (n.category) matchQuery = matchQuery.eq("category", n.category);
    else continue;

    const { data: match } = await matchQuery.maybeSingle();
    const matchRow = match as {
      id: string;
      name: string;
      image_url: string | null;
    } | null;
    if (!matchRow) continue;

    nationalPromos.push({
      id: n.id,
      title: n.title,
      tagline: n.tagline,
      brand: n.brand,
      category: n.category,
      starts_at: n.starts_at,
      ends_at: n.ends_at,
      store_revenue_share_pct: n.store_revenue_share_pct,
      opted_out: optedOutSet.has(n.id),
      matched_inventory_id: matchRow.id,
      matched_inventory_name: matchRow.name,
      matched_inventory_image_url: matchRow.image_url,
    });
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Promotions</h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-1">
          Your featured items, plus sponsored campaigns from our partners.
        </p>
      </div>

      {/* Section 1: store-owned featured items */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
            Your featured items
          </h2>
          <Link
            href="/inventory"
            className="text-xs text-[color:var(--color-gold)] hover:underline"
          >
            Feature a product →
          </Link>
        </div>

        {storePromos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[color:var(--color-border)] p-8 text-center">
            <p className="text-sm text-[color:var(--color-muted)]">
              No featured items right now.
            </p>
            <p className="text-xs text-[color:var(--color-muted)] mt-1">
              Open a product in Inventory and click &ldquo;Feature this
              product&rdquo; to spotlight it on your shop page and in
              Gabby&apos;s recommendations.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-[color:var(--color-border)] overflow-hidden">
            {storePromos.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-4 px-4 py-3 border-t border-[color:var(--color-border)] first:border-t-0"
              >
                <Link
                  href={`/inventory/${p.inventory_id}`}
                  className="block w-14 h-14 flex-shrink-0"
                >
                  <ProductImage
                    src={p.inventory_image_url}
                    alt={p.inventory_name ?? p.title}
                    brand={p.inventory_brand}
                    size="md"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{p.title}</p>
                  {p.tagline && (
                    <p className="text-xs text-[color:var(--color-muted)] italic truncate">
                      {p.tagline}
                    </p>
                  )}
                  <p className="text-[10px] text-[color:var(--color-muted)] mt-0.5">
                    {p.inventory_name ?? "Product"} ·{" "}
                    {p.inventory_price != null
                      ? `$${Number(p.inventory_price).toFixed(2)}`
                      : "—"}{" "}
                    · ends {new Date(p.ends_at).toLocaleDateString()}
                  </p>
                </div>
                {isManager && (
                  <form action={endPromotionAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline whitespace-nowrap"
                    >
                      End early
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: national sponsored campaigns */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
            Sponsored partner campaigns
          </h2>
          <span className="text-[10px] text-[color:var(--color-muted)]">
            Auto-enabled. You keep the revenue share shown below.
          </span>
        </div>

        {nationalPromos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[color:var(--color-border)] p-8 text-center">
            <p className="text-sm text-[color:var(--color-muted)]">
              No active partner campaigns match your inventory right now.
            </p>
            <p className="text-xs text-[color:var(--color-muted)] mt-1">
              When a national brand (say, Bacardí) runs a campaign and you
              carry a matching product in stock, it&apos;ll show up here —
              and you&apos;ll earn a cut of every sale it drives.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-[color:var(--color-border)] overflow-hidden">
            {nationalPromos.map((n) => (
              <div
                key={n.id}
                className={`flex items-center gap-4 px-4 py-3 border-t border-[color:var(--color-border)] first:border-t-0 ${
                  n.opted_out ? "opacity-60" : ""
                }`}
              >
                <div className="w-14 h-14 flex-shrink-0">
                  <ProductImage
                    src={n.matched_inventory_image_url}
                    alt={n.matched_inventory_name ?? n.title}
                    brand={n.brand}
                    size="md"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{n.title}</p>
                    <span className="text-[9px] tracking-widest uppercase font-semibold px-1.5 py-0.5 rounded bg-black/80 text-white flex-shrink-0">
                      Sponsored
                    </span>
                    {n.opted_out && (
                      <span className="text-[9px] tracking-widest uppercase font-semibold px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 flex-shrink-0">
                        Opted out
                      </span>
                    )}
                  </div>
                  {n.tagline && (
                    <p className="text-xs text-[color:var(--color-muted)] italic truncate">
                      {n.tagline}
                    </p>
                  )}
                  <p className="text-[10px] text-[color:var(--color-muted)] mt-0.5">
                    Matches: {n.matched_inventory_name ?? "—"} · Your share:{" "}
                    <strong>{n.store_revenue_share_pct}%</strong> · ends{" "}
                    {new Date(n.ends_at).toLocaleDateString()}
                  </p>
                </div>
                {isManager && !n.opted_out && (
                  <form action={optOutOfNationalPromoAction}>
                    <input type="hidden" name="promotion_id" value={n.id} />
                    <button
                      type="submit"
                      className="text-xs text-[color:var(--color-muted)] hover:text-red-600 hover:underline whitespace-nowrap"
                      title="Hide this sponsored campaign from your shop page and Gabby's recommendations. You can re-enable by contacting support."
                    >
                      Opt out
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-[color:var(--color-muted)] leading-relaxed">
          Partner campaigns are managed by BevTek&apos;s national sales team.
          We only run campaigns for products you actually carry and have in
          stock. Customers always see a small &ldquo;Sponsored&rdquo; marker
          on partner items, and Gabby discloses sponsorship when recommending
          them out loud.
        </p>
      </section>
    </div>
  );
}
