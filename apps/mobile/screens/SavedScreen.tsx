import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";
import ProductDetailModal, { type Product } from "../components/ProductDetailModal";

type SavedRow = {
  id: string;
  item_id: string;
  saved_at: string;
  notes: string | null;
  name: string;
  brand: string | null;
  price: number | null;
  stock_qty: number;
  image_url: string | null;
  description_short: string | null;
  flavor_notes: string | null;
  tasting_notes: string | null;
  store_id: string;
  store_name: string;
};

export default function SavedScreen() {
  const [rows, setRows] = useState<SavedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc("my_saved_products");
      if (err) throw err;
      setRows((data as SavedRow[] | null) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load saved items");
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = (r: SavedRow) => {
    setActive({
      id: r.item_id,
      name: r.name,
      brand: r.brand,
      category: null,
      subcategory: null,
      price: r.price,
      stock_qty: r.stock_qty,
      image_url: r.image_url,
      description_short: r.description_short,
      flavor_notes: r.flavor_notes,
      tasting_notes: r.tasting_notes,
      is_staff_pick: false,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved</Text>
        <Text style={styles.sub}>
          Everything you&apos;ve bookmarked — tap to hold or find in store.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
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
      >
        {loading && (
          <ActivityIndicator
            color={colors.gold}
            size="small"
            style={{ marginTop: 40 }}
          />
        )}

        {!loading && error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error.includes("must be signed in")
                ? "Sign in to see your saved products."
                : error}
            </Text>
          </View>
        )}

        {!loading && !error && rows.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>❤️</Text>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyBody}>
              When you find something you like in Gabby, tap the ♡ Save button
              to stash it here for later.
            </Text>
          </View>
        )}

        {!loading &&
          rows.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.card}
              onPress={() => openDetail(r)}
              activeOpacity={0.8}
            >
              <View style={styles.thumbWrap}>
                {r.image_url ? (
                  <Image source={{ uri: r.image_url }} style={styles.thumb} />
                ) : (
                  <Text style={styles.thumbIcon}>🍾</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={2}>
                  {r.name}
                </Text>
                {r.brand && <Text style={styles.cardBrand}>{r.brand}</Text>}
                <View style={styles.cardFooter}>
                  {typeof r.price === "number" && (
                    <Text style={styles.cardPrice}>${r.price.toFixed(2)}</Text>
                  )}
                  <Text style={styles.cardStore}>{r.store_name}</Text>
                </View>
              </View>
              <Text style={styles.chev}>›</Text>
            </TouchableOpacity>
          ))}
      </ScrollView>

      <ProductDetailModal
        product={active}
        visible={!!active}
        onClose={() => {
          setActive(null);
          load();
        }}
        onBackToResults={() => setActive(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FBF7F0" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.fg,
    letterSpacing: -0.4,
  },
  sub: { fontSize: 12, color: colors.muted, marginTop: 4 },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 8,
    paddingHorizontal: 30,
  },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.fg },
  emptyBody: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FBBF24",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: "#78350F", fontSize: 13 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#FBF7F0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumb: { width: "100%", height: "100%" },
  thumbIcon: { fontSize: 26 },
  cardName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.fg,
    lineHeight: 19,
  },
  cardBrand: { fontSize: 12, color: colors.muted, marginTop: 2 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  cardPrice: { fontSize: 14, fontWeight: "700", color: colors.gold },
  cardStore: { fontSize: 11, color: colors.muted },
  chev: { fontSize: 26, color: colors.muted, fontWeight: "300" },
});
