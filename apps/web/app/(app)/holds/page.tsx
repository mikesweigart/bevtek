import { createClient } from "@/utils/supabase/server";
import { flushHoldAlertsForCurrentStore } from "@/lib/email/flushHoldAlerts";
import {
  pickupHoldAction,
  cancelHoldAction,
  acceptHoldAction,
  placedAtFrontAction,
  cannotFulfillAction,
} from "./actions";

type HoldRow = {
  id: string;
  item_id: string | null;
  item_snapshot: {
    name?: string;
    brand?: string;
    sku?: string;
    price?: number | string;
    stock_at_request?: number;
  };
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  quantity: number;
  notes: string | null;
  status:
    | "pending"
    | "in_progress"
    | "confirmed"
    | "picked_up"
    | "cancelled"
    | "cannot_fulfill"
    | "expired";
  source: string;
  hold_until: string;
  created_at: string;
  confirmed_at: string | null;
  picked_up_at: string | null;
  confirmed_by: string | null;
  picked_up_by: string | null;
  in_progress_by: string | null;
  in_progress_at: string | null;
  cannot_fulfill_reason: string | null;
};

function fmtPhone(n: string | null): string {
  if (!n) return "—";
  const d = n.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1"))
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10)
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return n;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default async function HoldsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "active" } = await searchParams;
  const supabase = await createClient();

  // Opportunistic notification flush — if any new holds came in since the
  // last time staff viewed this page, email the owner now. Awaited so the
  // send actually completes on serverless; swallow failures so the page
  // always renders.
  try {
    await flushHoldAlertsForCurrentStore();
  } catch {
    // best-effort; never block the queue view
  }

  let query = supabase
    .from("hold_requests")
    .select(
      "id, item_id, item_snapshot, customer_name, customer_phone, customer_email, quantity, notes, status, source, hold_until, created_at, confirmed_at, picked_up_at, confirmed_by, picked_up_by, in_progress_by, in_progress_at, cannot_fulfill_reason",
    )
    .order("created_at", { ascending: false });

  if (filter === "active") {
    query = query.in("status", ["pending", "in_progress", "confirmed"]);
  } else if (filter === "picked_up") {
    query = query.eq("status", "picked_up");
  } else if (filter === "cancelled") {
    query = query.in("status", ["cancelled", "expired", "cannot_fulfill"]);
  }

  const { data: holds } = (await query) as { data: HoldRow[] | null };
  const list = holds ?? [];

  // Look up teammate names for the confirmed_by / picked_up_by columns so
  // we can show "Confirmed by Alex in 4m" on the card.
  const userIds = Array.from(
    new Set(
      list
        .flatMap((h) => [h.confirmed_by, h.picked_up_by])
        .filter((x): x is string => Boolean(x)),
    ),
  );
  const userNames = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", userIds);
    for (const u of (users ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string;
    }>) {
      userNames.set(u.id, u.full_name || u.email.split("@")[0] || "teammate");
    }
  }

  const counts = await Promise.all([
    supabase
      .from("hold_requests")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "in_progress", "confirmed"]),
    supabase
      .from("hold_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
  const activeCount = counts[0].count ?? 0;
  const pendingCount = counts[1].count ?? 0;

  const tabs = [
    { key: "active", label: "Active", count: activeCount },
    { key: "picked_up", label: "Picked up", count: undefined },
    { key: "cancelled", label: "Cancelled", count: undefined },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hold requests
          </h1>
          <p className="text-sm text-[color:var(--color-muted)]">
            {pendingCount > 0 ? (
              <>
                <span className="text-amber-600 font-semibold">
                  {pendingCount} pending
                </span>{" "}
                · {activeCount} active
              </>
            ) : (
              <>{activeCount} active</>
            )}
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-[color:var(--color-border)] -mx-1 px-1">
        {tabs.map((t) => {
          const active = t.key === filter;
          return (
            <a
              key={t.key}
              href={`/holds?filter=${t.key}`}
              className={`px-3 py-2 text-sm border-b-2 ${
                active
                  ? "border-[color:var(--color-gold)] text-[color:var(--color-fg)]"
                  : "border-transparent text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--color-gold)] text-white">
                  {t.count}
                </span>
              )}
            </a>
          );
        })}
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[color:var(--color-border)] p-10 text-center">
          <p className="text-sm text-[color:var(--color-muted)]">
            No {filter === "active" ? "active" : filter === "picked_up" ? "picked-up" : "cancelled"} holds.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((h) => (
            <HoldCard key={h.id} hold={h} userNames={userNames} />
          ))}
        </div>
      )}
    </div>
  );
}

function elapsed(fromIso: string, toIso: string | null): string {
  if (!toIso) return "";
  const diff = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (diff <= 0) return "instantly";
  const m = Math.round(diff / 60000);
  if (m < 1) return "under a minute";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

function HoldCard({
  hold,
  userNames,
}: {
  hold: HoldRow;
  userNames: Map<string, string>;
}) {
  const confirmedName = hold.confirmed_by
    ? userNames.get(hold.confirmed_by)
    : null;
  const pickedUpName = hold.picked_up_by
    ? userNames.get(hold.picked_up_by)
    : null;
  const confirmElapsed = elapsed(hold.created_at, hold.confirmed_at);
  const pickupElapsed = elapsed(
    hold.confirmed_at ?? hold.created_at,
    hold.picked_up_at,
  );
  const price =
    hold.item_snapshot?.price != null
      ? `$${Number(hold.item_snapshot.price).toFixed(2)}`
      : "—";
  const itemName = hold.item_snapshot?.name ?? "Unknown item";
  const brand = hold.item_snapshot?.brand;

  const statusColor = {
    pending: "bg-amber-100 text-amber-900",
    in_progress: "bg-blue-100 text-blue-900",
    confirmed: "bg-green-100 text-green-900",
    picked_up: "bg-zinc-100 text-zinc-700",
    cancelled: "bg-red-50 text-red-800",
    cannot_fulfill: "bg-zinc-100 text-zinc-600",
    expired: "bg-zinc-100 text-zinc-500",
  }[hold.status];

  const statusLabel = {
    pending: "New request",
    in_progress: "Grabbing now",
    confirmed: "Ready at front",
    picked_up: "Picked up",
    cancelled: "Cancelled",
    cannot_fulfill: "Closed — can't fulfill",
    expired: "Expired",
  }[hold.status];

  const inProgressName = hold.in_progress_by
    ? userNames.get(hold.in_progress_by)
    : null;

  return (
    <div className="rounded-lg border border-[color:var(--color-border)] p-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-[10px] tracking-widest uppercase px-2 py-0.5 rounded ${statusColor}`}
          >
            {statusLabel}
          </span>
          <span className="text-[10px] text-[color:var(--color-muted)]">
            {hold.source} · {relativeTime(hold.created_at)}
          </span>
        </div>
        <p className="font-semibold">
          {hold.quantity > 1 && <span className="mr-1">{hold.quantity}×</span>}
          {brand && <span className="text-[color:var(--color-muted)]">{brand} · </span>}
          {itemName}{" "}
          <span className="text-[color:var(--color-gold)]">{price}</span>
        </p>
        <p className="text-sm mt-0.5">
          {hold.customer_name}{" "}
          <span className="text-[color:var(--color-muted)]">
            {hold.customer_phone && `· ${fmtPhone(hold.customer_phone)}`}
            {hold.customer_email && ` · ${hold.customer_email}`}
          </span>
        </p>
        {hold.notes && (
          <p className="text-xs text-[color:var(--color-muted)] mt-1 italic">
            “{hold.notes}”
          </p>
        )}
        {(confirmedName || pickedUpName || inProgressName) && (
          <p className="text-[11px] text-[color:var(--color-muted)] mt-2">
            {inProgressName && hold.status === "in_progress" && (
              <>
                Grabbing now:{" "}
                <span className="font-semibold text-[color:var(--color-fg)]">
                  {inProgressName}
                </span>
                {hold.in_progress_at &&
                  ` · started ${elapsed(hold.in_progress_at, new Date().toISOString())} ago`}
              </>
            )}
            {confirmedName && (
              <>
                Ready by{" "}
                <span className="font-semibold text-[color:var(--color-fg)]">
                  {confirmedName}
                </span>
                {confirmElapsed && ` in ${confirmElapsed}`}
              </>
            )}
            {confirmedName && pickedUpName && " · "}
            {pickedUpName && (
              <>
                Picked up via{" "}
                <span className="font-semibold text-[color:var(--color-fg)]">
                  {pickedUpName}
                </span>
                {pickupElapsed && ` after ${pickupElapsed}`}
              </>
            )}
          </p>
        )}
        {hold.status === "cannot_fulfill" && hold.cannot_fulfill_reason && (
          <p className="text-[11px] text-[color:var(--color-muted)] mt-2 italic">
            Closed — {hold.cannot_fulfill_reason}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5 items-end">
        {/* Step 1: staff sees the new request, taps Accept & Grab */}
        {hold.status === "pending" && (
          <>
            <form action={acceptHoldAction}>
              <input type="hidden" name="id" value={hold.id} />
              <button
                type="submit"
                className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
              >
                ✓ Accept & Grab Item
              </button>
            </form>
            <details className="relative">
              <summary className="text-xs text-red-600 hover:underline cursor-pointer list-none">
                Can't fulfill
              </summary>
              <form
                action={cannotFulfillAction}
                className="absolute right-0 top-full mt-1 z-10 w-64 bg-white border border-[color:var(--color-border)] rounded-md shadow-lg p-3 space-y-2"
              >
                <input type="hidden" name="id" value={hold.id} />
                <p className="text-xs font-medium">Reason for the customer</p>
                <select
                  name="reason"
                  defaultValue="Out of stock"
                  className="w-full text-xs border border-[color:var(--color-border)] rounded px-2 py-1"
                >
                  <option>Out of stock</option>
                  <option>Couldn't locate it</option>
                  <option>Damaged / not sellable</option>
                  <option>Other</option>
                </select>
                <button
                  type="submit"
                  className="w-full rounded-md bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-semibold"
                >
                  Send update to customer
                </button>
              </form>
            </details>
          </>
        )}
        {/* Step 2: staff has it in-hand, taps Item Placed at Front */}
        {hold.status === "in_progress" && (
          <>
            <form action={placedAtFrontAction}>
              <input type="hidden" name="id" value={hold.id} />
              <button
                type="submit"
                className="rounded-md bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
              >
                🏁 Item Placed at Front
              </button>
            </form>
            <details className="relative">
              <summary className="text-xs text-red-600 hover:underline cursor-pointer list-none">
                Can't find it
              </summary>
              <form
                action={cannotFulfillAction}
                className="absolute right-0 top-full mt-1 z-10 w-64 bg-white border border-[color:var(--color-border)] rounded-md shadow-lg p-3 space-y-2"
              >
                <input type="hidden" name="id" value={hold.id} />
                <p className="text-xs font-medium">Reason for the customer</p>
                <select
                  name="reason"
                  defaultValue="Couldn't locate it"
                  className="w-full text-xs border border-[color:var(--color-border)] rounded px-2 py-1"
                >
                  <option>Couldn't locate it</option>
                  <option>Out of stock</option>
                  <option>Damaged / not sellable</option>
                  <option>Other</option>
                </select>
                <button
                  type="submit"
                  className="w-full rounded-md bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-xs font-semibold"
                >
                  Send update to customer
                </button>
              </form>
            </details>
          </>
        )}
        {/* Step 3: at the front, waiting for customer */}
        {hold.status === "confirmed" && (
          <>
            <form action={pickupHoldAction}>
              <input type="hidden" name="id" value={hold.id} />
              <button
                type="submit"
                className="rounded-md bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
              >
                Mark as picked up
              </button>
            </form>
            <form action={cancelHoldAction}>
              <input type="hidden" name="id" value={hold.id} />
              <button
                type="submit"
                className="text-xs text-red-600 hover:underline"
              >
                Cancel hold
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
