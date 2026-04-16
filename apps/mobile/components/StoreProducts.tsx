import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, FlatList } from "react-native";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";

type Product = {
  id: string;
  name: string;
  brand: string | null;
  price: number | null;
  stock_qty: number;
  image_url: string | null;
  sku: string | null;
};

type Props = {
  /** Keywords to search inventory (e.g., "bourbon", "irish whiskey") */
  keywords: string[];
  /** Fallback title if no inventory */
  title?: string;
  /** Max items to show */
  limit?: number;
};

/**
 * Displays products from the store's actual inventory matching the module topic.
 * If the store has uploaded inventory, shows their real products + prices + images.
 * If not, shows a subtle prompt to import inventory.
 */
export function StoreProducts({
  keywords,
  title = "What we carry",
  limit = 5,
}: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Build OR clauses for each keyword across name, brand, category
      const clauses = keywords
        .flatMap((k) => [
          `name.ilike.%${k}%`,
          `brand.ilike.%${k}%`,
          `category.ilike.%${k}%`,
        ])
        .join(",");

      const { data } = await supabase
        .from("inventory")
        .select("id, name, brand, price, stock_qty, image_url, sku")
        .or(clauses)
        .eq("is_active", true)
        .gt("stock_qty", 0)
        .order("stock_qty", { ascending: false })
        .limit(limit);

      setProducts((data as Product[] | null) ?? []);
      setLoading(false);
    })();
  }, [keywords.join(","), limit]);

  if (loading) return null;

  if (products.length === 0) {
    return (
      <View style={s.emptyCard}>
        <Text style={s.emptyTitle}>From your inventory</Text>
        <Text style={s.emptyText}>
          Import your store's inventory to see your actual products here — with
          your prices and stock levels.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.sectionTitle}>{title}</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={products}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <View style={s.card}>
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={s.productImage}
                resizeMode="contain"
              />
            ) : (
              <View style={[s.productImage, s.imagePlaceholder]}>
                <Text style={s.placeholderText}>
                  {(item.brand ?? item.name).slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            {item.brand && (
              <Text style={s.brand} numberOfLines={1}>
                {item.brand}
              </Text>
            )}
            <Text style={s.name} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={s.priceRow}>
              {item.price != null && (
                <Text style={s.price}>
                  ${Number(item.price).toFixed(2)}
                </Text>
              )}
              <Text
                style={[
                  s.stock,
                  item.stock_qty <= 3 && { color: "#d97706" },
                ]}
              >
                {item.stock_qty} in stock
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.gold,
    marginBottom: 10,
  },
  card: {
    width: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: colors.bg,
  },
  productImage: {
    width: "100%",
    height: 100,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    marginBottom: 8,
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBF7F0",
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.gold,
  },
  brand: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  price: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.gold,
  },
  stock: {
    fontSize: 10,
    color: colors.muted,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 17,
  },
});
