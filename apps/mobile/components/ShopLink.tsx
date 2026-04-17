import { TouchableOpacity, Text, StyleSheet, Linking } from "react-native";
import { colors } from "../lib/theme";

type Props = {
  /** The store's slug for the Megan Shopper storefront */
  storeSlug: string | null;
  /** Search query to pre-fill on the storefront (e.g., "bourbon") */
  searchQuery: string;
};

/**
 * Links the module to the store's public Megan Shopper storefront,
 * pre-filtered by the module topic. Staff tap this to show a customer
 * the actual products on the store's web storefront.
 */
export function ShopLink({ storeSlug, searchQuery }: Props) {
  if (!storeSlug) return null;

  const BASE = "https://bevtek-web.vercel.app"; // TODO: use store's custom domain
  const url = `${BASE}/s/${storeSlug}?q=${encodeURIComponent(searchQuery)}`;

  return (
    <TouchableOpacity
      style={s.button}
      onPress={() => Linking.openURL(url)}
      activeOpacity={0.7}
    >
      <Text style={s.icon}>🛍️</Text>
      <Text style={s.label}>Show customer in store →</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  icon: { fontSize: 18 },
  label: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
