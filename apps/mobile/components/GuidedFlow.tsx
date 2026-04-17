import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../lib/theme";
import tree from "../lib/gabby/tree.json";

const WEB_BASE =
  process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://bevtek-web.vercel.app";

// -----------------------------------------------------------------------
// Types — mirror tree.json. Stays permissive on purpose: the tree JSON is
// authored by humans and we want a malformed node to degrade gracefully,
// not crash the UI.
// -----------------------------------------------------------------------
type Filters = {
  category?: string;
  subcategory?: string;
  style_any?: string[];
  flavor_any?: string[];
  intended_use_any?: string[];
  body?: string;
  sweetness?: string;
  hop_level?: string;
  is_local?: boolean;
  price_min?: number;
  price_max?: number;
};

type Option = {
  label: string;
  emoji?: string;
  next?: string;
  action?: "recommend";
  filters?: Filters;
};

type Node = {
  kind: "choice";
  title: string;
  subtitle?: string;
  category?: string;
  options: Option[];
};

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  price: number | null;
  stock_qty: number;
  description_short: string | null;
  flavor_notes: string | null;
  tasting_notes: string | null;
  is_staff_pick: boolean | null;
};

type Frame = { nodeId: string; label: string };

function mergeFilters(a: Filters, b?: Filters): Filters {
  if (!b) return a;
  const out: Filters = { ...a };
  for (const k of Object.keys(b) as (keyof Filters)[]) {
    const bv = b[k];
    if (bv === undefined) continue;
    const av = out[k];
    if (Array.isArray(av) && Array.isArray(bv)) {
      // Intersect array filters so each step narrows, doesn't widen.
      const set = new Set(av.map((x) => x.toLowerCase()));
      const intersect = bv.filter((x) => set.has(x.toLowerCase()));
      (out[k] as unknown) = intersect.length > 0 ? intersect : bv;
    } else {
      (out[k] as unknown) = bv;
    }
  }
  return out;
}

type Props = {
  storeId: string | null;
  storeName?: string;
  onExit?: () => void;
};

export default function GuidedFlow({ storeId, storeName, onExit }: Props) {
  const NODES = (tree as unknown as { root: string; nodes: Record<string, Node> });
  const [stack, setStack] = useState<Frame[]>([{ nodeId: NODES.root, label: "Start" }]);
  const [filters, setFilters] = useState<Filters>({});
  const [results, setResults] = useState<Product[] | null>(null);
  const [relaxed, setRelaxed] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Keep a filter-history stack so Back undoes the narrowing cleanly.
  const filterHistory = useRef<Filters[]>([{}]);

  const currentNodeId = stack[stack.length - 1].nodeId;
  const node: Node | undefined = NODES.nodes[currentNodeId];

  const runRecommend = useCallback(
    async (finalFilters: Filters) => {
      if (!storeId) {
        setError("No store connected yet.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${WEB_BASE}/api/gabby/recommend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId, filters: finalFilters, limit: 20 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
        setResults((data.products ?? []) as Product[]);
        setRelaxed(data.relaxed ?? []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Network error";
        setError(msg);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [storeId],
  );

  const choose = useCallback(
    (opt: Option) => {
      const nextFilters = mergeFilters(filters, opt.filters);
      setFilters(nextFilters);
      filterHistory.current.push(nextFilters);

      if (opt.action === "recommend") {
        setStack((s) => [...s, { nodeId: "__results__", label: opt.label }]);
        void runRecommend(nextFilters);
        return;
      }
      if (opt.next && NODES.nodes[opt.next]) {
        setStack((s) => [...s, { nodeId: opt.next!, label: opt.label }]);
      }
    },
    [filters, runRecommend, NODES.nodes],
  );

  const goBack = useCallback(() => {
    if (stack.length <= 1) {
      onExit?.();
      return;
    }
    setStack((s) => s.slice(0, -1));
    filterHistory.current.pop();
    const prev = filterHistory.current[filterHistory.current.length - 1] ?? {};
    setFilters(prev);
    setResults(null);
    setRelaxed([]);
    setError(null);
  }, [stack.length, onExit]);

  const restart = useCallback(() => {
    setStack([{ nodeId: NODES.root, label: "Start" }]);
    setFilters({});
    filterHistory.current = [{}];
    setResults(null);
    setRelaxed([]);
    setError(null);
  }, [NODES.root]);

  const breadcrumbs = useMemo(
    () => stack.slice(1).map((f) => f.label).join(" › "),
    [stack],
  );

  const isResultsView = currentNodeId === "__results__";

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      {/* Breadcrumb header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.crumbs} numberOfLines={1}>
          {breadcrumbs || (storeName ? storeName : "Gabby")}
        </Text>
        <TouchableOpacity onPress={restart} hitSlop={8}>
          <Text style={styles.restartText}>Restart</Text>
        </TouchableOpacity>
      </View>

      {/* Choice node */}
      {!isResultsView && node && (
        <>
          <Text style={styles.title}>{node.title}</Text>
          {node.subtitle && <Text style={styles.subtitle}>{node.subtitle}</Text>}
          <View style={{ gap: 10, marginTop: 14 }}>
            {node.options.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={styles.option}
                onPress={() => choose(opt)}
                activeOpacity={0.7}
              >
                {opt.emoji && <Text style={styles.optEmoji}>{opt.emoji}</Text>}
                <Text style={styles.optLabel}>{opt.label}</Text>
                <Text style={styles.optArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Results view */}
      {isResultsView && (
        <View style={{ gap: 12 }}>
          <Text style={styles.title}>
            {loading ? "Finding matches..." : `Here's what I'd pick for you`}
          </Text>
          {!loading && relaxed.length > 0 && (
            <View style={styles.relaxBanner}>
              <Text style={styles.relaxText}>
                I didn&apos;t find exact matches, so I opened up the search on:{" "}
                <Text style={{ fontWeight: "700" }}>{relaxed.join(", ")}</Text>.
              </Text>
            </View>
          )}
          {loading && (
            <ActivityIndicator size="small" color={colors.gold} style={{ marginTop: 20 }} />
          )}
          {!loading && error && (
            <Text style={styles.error}>Couldn&apos;t reach Gabby — {error}</Text>
          )}
          {!loading && results && results.length === 0 && !error && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing in stock right now.</Text>
              <Text style={styles.emptyBody}>
                The team can check the back room or order this in for you.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={restart}>
                <Text style={styles.primaryBtnText}>Start over</Text>
              </TouchableOpacity>
            </View>
          )}
          {!loading && results && results.map((p) => (
            <View key={p.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.cardName} numberOfLines={2}>{p.name}</Text>
                  {p.is_staff_pick && (
                    <View style={styles.pickBadge}>
                      <Text style={styles.pickText}>★ Staff pick</Text>
                    </View>
                  )}
                </View>
                {p.brand && <Text style={styles.cardBrand}>{p.brand}</Text>}
                <Text style={styles.cardDesc} numberOfLines={3}>
                  {p.description_short || p.flavor_notes || p.tasting_notes || ""}
                </Text>
                <View style={styles.cardFooter}>
                  {typeof p.price === "number" && (
                    <Text style={styles.cardPrice}>${p.price.toFixed(2)}</Text>
                  )}
                  <Text style={styles.cardStock}>
                    {p.stock_qty > 5 ? "In stock" : `Only ${p.stock_qty} left`}
                  </Text>
                </View>
              </View>
            </View>
          ))}
          {!loading && results && results.length > 0 && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={restart}>
              <Text style={styles.secondaryBtnText}>Start a new search</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 10,
  },
  backBtn: { paddingVertical: 4, paddingRight: 6 },
  backText: { color: colors.gold, fontWeight: "700", fontSize: 14 },
  crumbs: {
    flex: 1,
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
  },
  restartText: { fontSize: 12, color: colors.muted, fontWeight: "500" },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.fg,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 20 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  optEmoji: { fontSize: 22 },
  optLabel: { flex: 1, fontSize: 15, color: colors.fg, fontWeight: "600" },
  optArrow: { fontSize: 22, color: colors.muted, fontWeight: "300" },
  relaxBanner: {
    backgroundColor: "#FBF7F0",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
  },
  relaxText: { fontSize: 12, color: colors.fg, lineHeight: 18 },
  error: { color: "#991B1B", fontSize: 13, marginTop: 8 },
  empty: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.fg },
  emptyBody: { fontSize: 13, color: colors.muted, textAlign: "center" },
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  cardName: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.fg, lineHeight: 20 },
  cardBrand: { fontSize: 12, color: colors.muted, marginTop: 2 },
  cardDesc: { fontSize: 13, color: colors.fg, marginTop: 6, lineHeight: 18 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  cardPrice: { fontSize: 15, fontWeight: "700", color: colors.gold },
  cardStock: { fontSize: 11, color: colors.muted },
  pickBadge: {
    backgroundColor: "#FBF7F0",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  pickText: { fontSize: 10, fontWeight: "700", color: colors.gold },
  primaryBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 8,
  },
  secondaryBtnText: { color: colors.gold, fontWeight: "700", fontSize: 13 },
});
