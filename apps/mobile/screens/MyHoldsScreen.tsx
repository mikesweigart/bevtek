import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
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
  store_id: string;
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Waiting for staff", color: "#b45309" },
  in_progress: { label: "Staff is grabbing it", color: "#2563eb" },
  confirmed: { label: "Ready for pickup", color: "#15803d" },
  picked_up: { label: "Picked up", color: colors.muted },
  cannot_fulfill: { label: "Couldn't fulfill — sorry", color: "#991b1b" },
  cancelled: { label: "Cancelled", color: "#991b1b" },
  expired: { label: "Expired", color: colors.muted },
};

export default function MyHoldsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [holds, setHolds] = useState<Hold[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("my_holds");
    if (!error) setHolds((data ?? []) as Hold[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
        <Text style={styles.empty}>No holds yet</Text>
        <Text style={styles.muted}>Tap &quot;Hold for me&quot; on any product to reserve it.</Text>
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
        const status = STATUS_META[item.status] ?? { label: item.status, color: colors.muted };
        const holdUntil = item.hold_until ? new Date(item.hold_until) : null;
        return (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name} numberOfLines={2}>
                {snap.name ?? "Item"}
              </Text>
              <Text style={styles.qty}>×{item.quantity}</Text>
            </View>
            {snap.brand ? <Text style={styles.brand}>{snap.brand}</Text> : null}
            <View style={[styles.row, { marginTop: 8 }]}>
              {snap.price != null ? (
                <Text style={styles.price}>${Number(snap.price).toFixed(2)}</Text>
              ) : (
                <Text style={styles.muted}>—</Text>
              )}
              <View style={[styles.statusPill, { backgroundColor: `${status.color}22` }]}>
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
            {holdUntil && item.status === "pending" ? (
              <Text style={styles.muted}>
                Held until {holdUntil.toLocaleString()}
              </Text>
            ) : null}
            {item.notes ? (
              <Text style={[styles.muted, { marginTop: 6 }]}>Note: {item.notes}</Text>
            ) : null}
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
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.fg, paddingRight: 10 },
  qty: { fontSize: 13, color: colors.muted },
  brand: { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.muted, marginTop: 2 },
  price: { fontSize: 16, fontWeight: "700", color: colors.gold },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: "600" },
});
