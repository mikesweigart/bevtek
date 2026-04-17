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
  status: string;
  quantity: number;
  notes: string | null;
  hold_until: string | null;
  created_at: string;
  item_snapshot: any;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  source: string | null;
};

const NEXT_STATUS: Record<string, string | null> = {
  pending: "confirmed",
  confirmed: "picked_up",
  picked_up: null,
  cancelled: null,
  expired: null,
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Confirm hold",
  confirmed: "Mark picked up",
};

/**
 * Employee-only screen. Shows the queue of active holds for this store's
 * staff to fulfill. Tap a hold to advance status (pending → confirmed →
 * picked_up) or long-press to cancel.
 *
 * RLS: holds_select already allows owner/manager/staff to see all holds
 * for their store (see migration 20260417140000).
 */
export default function HoldsQueueScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [holds, setHolds] = useState<Hold[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("hold_requests")
      .select(
        "id, status, quantity, notes, hold_until, created_at, item_snapshot, customer_name, customer_phone, customer_email, source",
      )
      .in("status", ["pending", "confirmed"])
      .order("created_at", { ascending: false });
    setHolds((data ?? []) as Hold[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function advance(h: Hold) {
    const next = NEXT_STATUS[h.status];
    if (!next) return;
    const { error } = await supabase
      .from("hold_requests")
      .update({ status: next })
      .eq("id", h.id);
    if (error) {
      Alert.alert("Update failed", error.message);
      return;
    }
    load();
  }

  function confirmCancel(h: Hold) {
    Alert.alert(
      "Cancel hold?",
      `Cancel hold for ${h.customer_name}?`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel hold",
          style: "destructive",
          onPress: async () => {
            await supabase
              .from("hold_requests")
              .update({ status: "cancelled" })
              .eq("id", h.id);
            load();
          },
        },
      ],
    );
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
          When a customer taps &quot;Hold for me&quot; on a product, it shows up here.
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
        const nextLabel = STATUS_LABEL[item.status];
        return (
          <TouchableOpacity
            style={styles.card}
            onLongPress={() => confirmCancel(item)}
            activeOpacity={0.85}
          >
            <View style={styles.row}>
              <Text style={[styles.badge, item.status === "pending" ? styles.badgePending : styles.badgeConfirmed]}>
                {item.status.toUpperCase()}
              </Text>
              <Text style={styles.time}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
            <Text style={styles.name} numberOfLines={2}>
              {snap.name ?? "Item"} <Text style={styles.qty}>×{item.quantity}</Text>
            </Text>
            {snap.brand ? <Text style={styles.brand}>{snap.brand}</Text> : null}
            <View style={[styles.row, { marginTop: 6 }]}>
              {snap.price != null ? (
                <Text style={styles.price}>${Number(snap.price).toFixed(2)}</Text>
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
              <Text style={[styles.muted, { marginTop: 4 }]}>&ldquo;{item.notes}&rdquo;</Text>
            ) : null}
            {nextLabel && (
              <TouchableOpacity style={styles.advanceBtn} onPress={() => advance(item)}>
                <Text style={styles.advanceText}>{nextLabel}</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.hint}>Long-press to cancel</Text>
          </TouchableOpacity>
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
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  badgePending: { backgroundColor: "#fef3c7", color: "#92400e" },
  badgeConfirmed: { backgroundColor: "#dcfce7", color: "#166534" },
  time: { fontSize: 10, color: colors.muted },
  name: { fontSize: 16, fontWeight: "700", color: colors.fg, marginTop: 8 },
  qty: { fontSize: 12, color: colors.muted, fontWeight: "500" },
  brand: { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.muted, marginTop: 2 },
  price: { fontSize: 15, fontWeight: "700", color: colors.gold },
  source: { fontSize: 10, color: colors.muted, textTransform: "uppercase", letterSpacing: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  customer: { fontSize: 14, fontWeight: "600", color: colors.fg },
  advanceBtn: {
    marginTop: 12,
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  advanceText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  hint: { fontSize: 9, color: colors.muted, textAlign: "center", marginTop: 6 },
});
