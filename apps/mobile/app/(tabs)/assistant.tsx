import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { colors } from "../../lib/theme";

type Item = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  price: number | null;
  stock_qty: number;
};

const SUGGESTIONS = [
  "bourbon under $50",
  "something for a gift",
  "dry red wine",
  "gluten-free beer",
];

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "we", "you", "they", "have", "has", "do",
  "does", "did", "any", "some", "of", "for", "in", "on", "with", "and", "or",
  "to", "from", "that", "this", "it", "me", "my", "our", "got", "get", "can",
  "what", "which", "who", "how", "about", "please", "show", "find", "give",
  "tell",
]);

function extractKeywords(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

export default function AssistantScreen() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function search(text?: string) {
    const q = (text ?? query).trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);

    const keywords = extractKeywords(q);
    if (keywords.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    const clauses = keywords
      .flatMap((k) => [
        `name.ilike.%${k}%`,
        `brand.ilike.%${k}%`,
        `category.ilike.%${k}%`,
      ])
      .join(",");

    const { data } = await supabase
      .from("inventory")
      .select("id, name, brand, category, price, stock_qty")
      .or(clauses)
      .eq("is_active", true)
      .order("stock_qty", { ascending: false })
      .limit(20);

    setResults((data as Item[] | null) ?? []);

    // Log query (best effort)
    if (user) {
      const { data: profile } = await supabase
        .from("users")
        .select("store_id")
        .eq("id", user.id)
        .maybeSingle();
      const storeId = (profile as any)?.store_id;
      if (storeId) {
        supabase.from("floor_queries").insert({
          store_id: storeId,
          user_id: user.id,
          query_text: q,
          response: `Found ${data?.length ?? 0} items.`,
          context: { keywords, source: "mobile" },
        });
      }
    }

    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={s.searchRow}>
        <TextInput
          style={s.input}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => search()}
          placeholder="Ask about a product, brand, or pairing"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={[s.askBtn, loading && { opacity: 0.6 }]}
          onPress={() => search()}
          disabled={loading}
        >
          <Text style={s.askBtnText}>{loading ? "..." : "Ask"}</Text>
        </TouchableOpacity>
      </View>

      {!searched && (
        <View style={s.suggestions}>
          {SUGGESTIONS.map((s_) => (
            <TouchableOpacity
              key={s_}
              style={s.chip}
              onPress={() => {
                setQuery(s_);
                search(s_);
              }}
            >
              <Text style={s.chipText}>{s_}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {searched && results.length === 0 && !loading && (
        <View style={s.empty}>
          <Text style={s.emptyText}>No matches in inventory.</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        renderItem={({ item }) => (
          <View style={s.resultCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={s.itemMeta}>
                {item.brand ?? ""}
                {item.brand && item.category ? " · " : ""}
                {item.category ?? ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {item.price != null && (
                <Text style={s.itemPrice}>
                  ${Number(item.price).toFixed(2)}
                </Text>
              )}
              <Text
                style={[
                  s.itemStock,
                  item.stock_qty <= 0
                    ? { color: "#dc2626" }
                    : item.stock_qty < 5
                      ? { color: "#d97706" }
                      : {},
                ]}
              >
                {item.stock_qty} in stock
              </Text>
            </View>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.fg,
  },
  askBtn: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  askBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 12, color: colors.muted },
  empty: { alignItems: "center", paddingTop: 40 },
  emptyText: { fontSize: 14, color: colors.muted },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  itemName: { fontSize: 15, fontWeight: "600" },
  itemMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  itemPrice: { fontSize: 16, fontWeight: "600", color: colors.gold },
  itemStock: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
