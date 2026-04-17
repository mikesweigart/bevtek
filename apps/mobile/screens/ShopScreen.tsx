import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  price: number | null;
  stock_qty: number;
  image_url: string | null;
  store_id: string;
};

type StoreOption = { id: string; name: string; slug: string };

/**
 * Customer-facing Shop screen. Browses a store's inventory and lets the
 * customer request a hold. If the signed-in customer has a store_id, we
 * scope to that store; otherwise we show the first active store with
 * inventory (future: a store picker).
 */
export default function ShopScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [store, setStore] = useState<StoreOption | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [holdingId, setHoldingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    // 1. Find the customer's store (user row) or fall back to first store
    const { data: authData } = await supabase.auth.getUser();
    let storeRow: StoreOption | null = null;

    if (authData?.user) {
      const { data: urow } = await supabase
        .from("users")
        .select("store_id, stores(id, name, slug)")
        .eq("id", authData.user.id)
        .maybeSingle();
      const s = (urow as any)?.stores;
      if (s) storeRow = { id: s.id, name: s.name, slug: s.slug };
    }

    if (!storeRow) {
      const { data } = await supabase
        .from("stores")
        .select("id, name, slug")
        .limit(1)
        .maybeSingle();
      if (data) storeRow = data as StoreOption;
    }

    setStore(storeRow);

    if (storeRow) {
      const { data } = await supabase
        .from("inventory")
        .select("id, name, brand, category, price, stock_qty, image_url, store_id")
        .eq("store_id", storeRow.id)
        .eq("is_active", true)
        .gt("stock_qty", 0)
        .order("stock_qty", { ascending: false })
        .limit(60);
      setProducts((data ?? []) as Product[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = ["all", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[]];

  const filtered = products.filter((p) => {
    if (category !== "all" && p.category !== category) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  async function requestHold(p: Product) {
    setHoldingId(p.id);
    try {
      const { data, error } = await supabase.rpc("request_hold_authed", {
        p_item_id: p.id,
        p_quantity: 1,
        p_notes: null,
      });
      if (error) throw error;
      Alert.alert(
        "On hold!",
        `${p.name} is being held for you. Check "My Holds" for pickup details.`,
      );
    } catch (e: any) {
      Alert.alert("Couldn't place hold", e?.message ?? "Please try again.");
    } finally {
      setHoldingId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!store) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No store connected yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.storeName}>{store.name}</Text>
        <Text style={styles.muted}>Tap Hold on anything you want set aside.</Text>
      </View>

      <TextInput
        placeholder="Search wines, spirits, beer..."
        value={search}
        onChangeText={setSearch}
        style={styles.search}
        placeholderTextColor={colors.muted}
      />

      <FlatList
        horizontal
        data={categories}
        keyExtractor={(c) => c}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        style={{ flexGrow: 0, marginBottom: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setCategory(item)}
            style={[
              styles.chip,
              category === item && { backgroundColor: colors.gold, borderColor: colors.gold },
            ]}
          >
            <Text style={[styles.chipText, category === item && { color: "#fff" }]}>
              {item === "all" ? "All" : item}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        numColumns={2}
        contentContainerStyle={{ padding: 12, gap: 12 }}
        columnWrapperStyle={{ gap: 12 }}
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
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.imageWrap}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.image} resizeMode="contain" />
              ) : (
                <Text style={styles.imagePlaceholder}>
                  {(item.brand ?? item.name).slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            {item.brand ? <Text style={styles.brand}>{item.brand}</Text> : null}
            <Text numberOfLines={2} style={styles.name}>
              {item.name}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>
                {item.price != null ? `$${Number(item.price).toFixed(2)}` : "—"}
              </Text>
              <Text
                style={[
                  styles.stock,
                  item.stock_qty <= 3 && { color: "#b45309", fontWeight: "600" },
                ]}
              >
                {item.stock_qty <= 3 ? `Only ${item.stock_qty}` : "In stock"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => requestHold(item)}
              disabled={holdingId === item.id}
              style={[styles.holdBtn, holdingId === item.id && { opacity: 0.5 }]}
            >
              <Text style={styles.holdBtnText}>
                {holdingId === item.id ? "Holding..." : "Hold for me"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.muted, { textAlign: "center", marginTop: 40 }]}>
            No matches. Try a different search.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  muted: { color: colors.muted, fontSize: 13 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  storeName: { fontSize: 22, fontWeight: "700", color: colors.fg },
  search: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.fg,
    backgroundColor: "#fff",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  chipText: { fontSize: 12, color: colors.fg },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  imageWrap: {
    aspectRatio: 1,
    backgroundColor: "#FBF7F0",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  imagePlaceholder: { fontSize: 24, fontWeight: "700", color: colors.gold },
  brand: { fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: colors.muted },
  name: { fontSize: 13, fontWeight: "600", color: colors.fg, minHeight: 32, marginTop: 2 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  price: { fontSize: 16, fontWeight: "700", color: colors.gold },
  stock: { fontSize: 10, color: colors.muted },
  holdBtn: {
    marginTop: 10,
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  holdBtnText: { color: "#fff", fontWeight: "600", fontSize: 12 },
});
