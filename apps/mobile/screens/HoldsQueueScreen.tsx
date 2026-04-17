import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";

type Hold = {
  id: string;
  status:
    | "pending"
    | "in_progress"
    | "confirmed"
    | "picked_up"
    | "cancelled"
    | "cannot_fulfill"
    | "expired";
  quantity: number;
  notes: string | null;
  hold_until: string | null;
  created_at: string;
  in_progress_at: string | null;
  confirmed_at: string | null;
  item_snapshot: {
    name?: string;
    brand?: string;
    price?: number | string;
  } | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  source: string | null;
};

type StatusMeta = {
  label: string;
  badge: string;
  badgeBg: string;
  badgeFg: string;
};

const STATUS: Record<Hold["status"], StatusMeta> = {
  pending: {
    label: "New request",
    badge: "REQUESTED",
    badgeBg: "#fef3c7",
    badgeFg: "#92400e",
  },
  in_progress: {
    label: "Grabbing now",
    badge: "IN PROGRESS",
    badgeBg: "#dbeafe",
    badgeFg: "#1e40af",
  },
  confirmed: {
    label: "Ready at front",
    badge: "READY",
    badgeBg: "#dcfce7",
    badgeFg: "#166534",
  },
  picked_up: {
    label: "Picked up",
    badge: "PICKED UP",
    badgeBg: "#f3f4f6",
    badgeFg: "#4b5563",
  },
  cancelled: {
    label: "Cancelled",
    badge: "CANCELLED",
    badgeBg: "#f3f4f6",
    badgeFg: "#4b5563",
  },
  cannot_fulfill: {
    label: "Couldn't fulfill",
    badge: "UNAVAILABLE",
    badgeBg: "#fee2e2",
    badgeFg: "#991b1b",
  },
  expired: {
    label: "Expired",
    badge: "EXPIRED",
    badgeBg: "#f3f4f6",
    badgeFg: "#4b5563",
  },
};

function relTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

/**
 * Employee-only staff queue. Mirrors the 3-state workflow from the web
 * /holds page: Requested → In Progress → Ready at Front → Picked Up,
 * with a "Can't fulfill" escape hatch on the first two states.
 *
 * Kept intentionally simple — staff are usually grabbing this with one
 * hand while holding a bottle in the other.
 */
export default function HoldsQueueScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [holds, setHolds] = useState<Hold[]>([]);

  const load = useCallback(async () => {
    // Opportunistic expiry sweep — same pattern as /holds on web.
    try {
      await supabase.rpc("expire_stale_holds");
    } catch {
      /* best-effort */
    }
    const { data } = await supabase
      .from("hold_requests")
      .select(
        "id, status, quantity, notes, hold_until, created_at, in_progress_at, confirmed_at, item_snapshot, customer_name, customer_phone, customer_email, source",
      )
      .in("status", ["pending", "in_progress", "confirmed"])
      .order("created_at", { ascending: false });
    setHolds((data ?? []) as Hold[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(h: Hold, patch: Record<string, unknown>) {
    const { data: auth } = await supabase.auth.getUser();
    const stamped = {
      ...patch,
      // Stamp the actor + timestamp for each transition so the customer
      // card can show "Alex · started 0:42 ago".
      ...(patch.status === "in_progress" && {
        in_progress_by: auth.user?.id ?? null,
        in_progress_at: new Date().toISOString(),
      }),
      ...(patch.status === "confirmed" && {
        confirmed_by: auth.user?.id ?? null,
        confirmed_at: new Date().toISOString(),
      }),
      ...(patch.status === "picked_up" && {
        picked_up_by: auth.user?.id ?? null,
        picked_up_at: new Date().toISOString(),
      }),
      ...(patch.status === "cannot_fulfill" && {
        cannot_fulfilled_by: auth.user?.id ?? null,
        cannot_fulfilled_at: new Date().toISOString(),
      }),
      ...(patch.status === "cancelled" && {
        cancelled_at: new Date().toISOString(),
      }),
    };
    const { error } = await supabase
      .from("hold_requests")
      .update(stamped)
      .eq("id", h.id);
    if (error) {
      Alert.alert("Update failed", error.message);
      return;
    }
    load();
  }

  function askCannotFulfill(h: Hold) {
    Alert.alert(
      "Why can't we fulfill this?",
      `Customer will be notified. Pick a reason:`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Out of stock",
          onPress: () =>
            updateStatus(h, {
              status: "cannot_fulfill",
              cannot_fulfill_reason: "Out of stock",
            }),
        },
        {
          text: "Can't locate",
          onPress: () =>
            updateStatus(h, {
              status: "cannot_fulfill",
              cannot_fulfill_reason: "Can't locate in store",
            }),
        },
        {
          text: "Damaged",
          onPress: () =>
            updateStatus(h, {
              status: "cannot_fulfill",
              cannot_fulfill_reason: "Damaged / not sellable",
            }),
        },
      ],
    );
  }

  function confirmCancel(h: Hold) {
    Alert.alert("Cancel hold?", `Cancel hold for ${h.customer_name}?`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel hold",
        style: "destructive",
        onPress: () => updateStatus(h, { status: "cancelled" }),
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (holds.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No active holds</Text>
        <Text style={styles.muted}>
          When a customer taps &quot;Hold for me&quot; on a product, it shows
          up here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={holds}
      keyExtractor={(h) => h.id}
      contentContainerStyle={{ padding: 14, gap: 12 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.gold}
        />
      }
      renderItem={({ item }) => {
        const snap = item.item_snapshot ?? {};
        const meta = STATUS[item.status];
        const timerSource =
          item.status === "in_progress"
            ? item.in_progress_at
            : item.status === "confirmed"
              ? item.confirmed_at
              : item.created_at;

        return (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text
                style={[
                  styles.badge,
                  { backgroundColor: meta.badgeBg, color: meta.badgeFg },
                ]}
              >
                {meta.badge}
              </Text>
              <Text style={styles.time}>{relTime(timerSource)}</Text>
            </View>
            <Text style={styles.name} numberOfLines={2}>
              {snap.name ?? "Item"}{" "}
              <Text style={styles.qty}>×{item.quantity}</Text>
            </Text>
            {snap.brand ? (
              <Text style={styles.brand}>{snap.brand}</Text>
            ) : null}
            <View style={[styles.row, { marginTop: 6 }]}>
              {snap.price != null ? (
                <Text style={styles.price}>
                  ${Number(snap.price).toFixed(2)}
                </Text>
              ) : null}
              <Text style={styles.source}>{item.source ?? "shopper"}</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.customer}>{item.customer_name}</Text>
            {item.customer_phone ? (
              <Text style={styles.muted}>{item.customer_phone}</Text>
            ) : null}
            {item.customer_email ? (
              <Text style={styles.muted}>{item.customer_email}</Text>
            ) : null}
            {item.notes ? (
              <Text style={[styles.muted, { marginTop: 4 }]}>
                &ldquo;{item.notes}&rdquo;
              </Text>
            ) : null}

            {/* Primary action per state */}
            {item.status === "pending" && (
              <>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() =>
                    updateStatus(item, { status: "in_progress" })
                  }
                >
                  <Text style={styles.primaryText}>✓ Accept & Grab Item</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.escapeBtn}
                  onPress={() => askCannotFulfill(item)}
                >
                  <Text style={styles.escapeText}>Can&rsquo;t fulfill</Text>
                </TouchableOpacity>
              </>
            )}
            {item.status === "in_progress" && (
              <>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => updateStatus(item, { status: "confirmed" })}
                >
                  <Text style={styles.primaryText}>
                    🏁 Item Placed at Front
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.escapeBtn}
                  onPress={() => askCannotFulfill(item)}
                >
                  <Text style={styles.escapeText}>Can&rsquo;t find it</Text>
                </TouchableOpacity>
              </>
            )}
            {item.status === "confirmed" && (
              <>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => updateStatus(item, { status: "picked_up" })}
                >
                  <Text style={styles.primaryText}>Mark as picked up</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.escapeBtn}
                  onPress={() => confirmCancel(item)}
                >
                  <Text style={styles.escapeText}>Cancel hold</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
    padding: 24,
    gap: 6,
  },
  empty: { fontSize: 18, fontWeight: "700", color: colors.fg },
  muted: { color: colors.muted, fontSize: 12, textAlign: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  time: { fontSize: 10, color: colors.muted },
  name: { fontSize: 16, fontWeight: "700", color: colors.fg, marginTop: 8 },
  qty: { fontSize: 12, color: colors.muted, fontWeight: "500" },
  brand: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.muted,
    marginTop: 2,
  },
  price: { fontSize: 15, fontWeight: "700", color: colors.gold },
  source: {
    fontSize: 10,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  customer: { fontSize: 14, fontWeight: "600", color: colors.fg },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  escapeBtn: {
    marginTop: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  escapeText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
});
