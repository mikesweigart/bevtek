// My List — the end-of-session summary the spec calls for.
//
// Four sections, collapsed into one scroll so shoppers can see everything
// they've touched in one glance:
//   1. 🛒 Virtual Cart     — ephemeral "considering"  (my_cart RPC)
//   2. ❤️ Saved for Later  — persisted bookmarks      (my_saved_products RPC)
//   3. 🛎️ In-Store Holds  — active requests          (my_holds RPC)
//   4. 🎯 Found in Store   — session-only checkmarks  (foundStore)
//
// Plus the three export paths from Section 3 of the spec:
// Text, Email, and a QR code that bundles the cart + saved into a
// shareable page on the web side. The export endpoints are stubs
// today — the QR fallback is zero-dep via qrserver.com so the user
// at least sees *something* immediately.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { resolveProductImageUri } from "../lib/images";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";
import { foundStore, type FoundItem } from "../lib/foundStore";
import ProductDetailModal, {
  type Product,
} from "../components/ProductDetailModal";

type CartRow = {
  id: string;
  item_id: string;
  quantity: number;
  added_at: string;
  name: string;
  brand: string | null;
  price: number | null;
  stock_qty: number;
  image_url: string | null;
  description_short: string | null;
  store_id: string;
  store_name: string;
};

type SavedRow = {
  id: string;
  item_id: string;
  saved_at: string;
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

type HoldRow = {
  id: string;
  status: string;
  quantity: number;
  hold_until: string | null;
  item_snapshot: {
    name?: string;
    brand?: string;
    price?: number | string;
  } | null;
};

const HOLD_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Requested", color: "#b45309" },
  in_progress: { label: "Grabbing now", color: "#2563eb" },
  confirmed: { label: "Ready at front", color: "#15803d" },
  picked_up: { label: "Picked up", color: colors.muted },
  cannot_fulfill: { label: "Unavailable", color: "#991b1b" },
  cancelled: { label: "Cancelled", color: colors.muted },
  expired: { label: "Expired", color: colors.muted },
};

export default function SummaryScreen() {
  const [cart, setCart] = useState<CartRow[]>([]);
  const [saved, setSaved] = useState<SavedRow[]>([]);
  const [holds, setHolds] = useState<HoldRow[]>([]);
  const [found, setFound] = useState<FoundItem[]>(foundStore.list());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [active, setActive] = useState<Product | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  // Re-render when the in-memory found list changes.
  useEffect(() => foundStore.subscribe(() => setFound(foundStore.list())), []);

  const load = useCallback(async () => {
    try {
      const [cartRes, savedRes, holdsRes] = await Promise.all([
        supabase.rpc("my_cart"),
        supabase.rpc("my_saved_products"),
        supabase.rpc("my_holds"),
      ]);
      setCart(((cartRes.data as CartRow[] | null) ?? []));
      setSaved(((savedRes.data as SavedRow[] | null) ?? []));
      setHolds(((holdsRes.data as HoldRow[] | null) ?? []));
    } catch {
      // Swallow — sections show their own empty states.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeHolds = useMemo(
    () =>
      holds.filter((h) =>
        ["pending", "in_progress", "confirmed"].includes(h.status),
      ),
    [holds],
  );

  const openCart = (r: CartRow) =>
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
      flavor_notes: null,
      tasting_notes: null,
      is_staff_pick: false,
    });

  const openSaved = (r: SavedRow) =>
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

  const total =
    cart.length + saved.length + activeHolds.length + found.length;

  const exportPayload = useMemo(() => {
    const lines: string[] = [];
    if (cart.length) {
      lines.push("🛒 Cart:");
      cart.forEach((c) =>
        lines.push(
          `  • ${c.name}${c.brand ? ` (${c.brand})` : ""} ×${c.quantity}${
            c.price != null ? ` — $${Number(c.price).toFixed(2)}` : ""
          }`,
        ),
      );
    }
    if (saved.length) {
      lines.push("", "❤️ Saved:");
      saved.forEach((s) =>
        lines.push(
          `  • ${s.name}${s.brand ? ` (${s.brand})` : ""}${
            s.price != null ? ` — $${Number(s.price).toFixed(2)}` : ""
          }`,
        ),
      );
    }
    if (activeHolds.length) {
      lines.push("", "🛎️ Holds:");
      activeHolds.forEach((h) =>
        lines.push(
          `  • ${h.item_snapshot?.name ?? "Item"} ×${h.quantity} — ${
            HOLD_STATUS[h.status]?.label ?? h.status
          }`,
        ),
      );
    }
    if (found.length) {
      lines.push("", "🎯 Found in store:");
      found.forEach((f) =>
        lines.push(`  • ${f.name}${f.brand ? ` (${f.brand})` : ""}`),
      );
    }
    return lines.join("\n") || "My BevTek list is empty.";
  }, [cart, saved, activeHolds, found]);

  const qrUrl = useMemo(() => {
    const data = encodeURIComponent(exportPayload.slice(0, 1800));
    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${data}`;
  }, [exportPayload]);

  const handleText = () => {
    // SMS deep link — device opens Messages pre-filled.
    const url = `sms:&body=${encodeURIComponent(exportPayload)}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Couldn't open Messages", "Try email or QR instead."),
    );
  };
  const handleEmail = () => {
    const url = `mailto:?subject=${encodeURIComponent(
      "My BevTek list",
    )}&body=${encodeURIComponent(exportPayload)}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Couldn't open email", "Try text or QR instead."),
    );
  };

  const removeFromCart = async (itemId: string) => {
    await supabase.rpc("remove_from_cart", { p_item_id: itemId });
    load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>My List</Text>
            <Text style={styles.sub}>
              {total === 0
                ? "Things you hold, save, or grab will appear here."
                : `${total} item${total === 1 ? "" : "s"} in your session`}
            </Text>
          </View>
          {total > 0 && (
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={() => setExportOpen(true)}
            >
              <Text style={styles.exportBtnText}>Take with me →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 60 }}
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

        {!loading && total === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🪴</Text>
            <Text style={styles.emptyTitle}>Your list is empty</Text>
            <Text style={styles.emptyBody}>
              Ask Gabby for a pick, then tap Hold, Save, or I Found It — it
              all lands here.
            </Text>
          </View>
        )}

        {!loading && cart.length > 0 && (
          <Section
            icon="🛒"
            title="Virtual Cart"
            sub="What you're thinking about right now"
          >
            {cart.map((r) => (
              <Row
                key={r.id}
                image={r.image_url}
                name={r.name}
                brand={r.brand}
                price={r.price}
                meta={`×${r.quantity} · ${r.store_name}`}
                onPress={() => openCart(r)}
                trailingAction={{
                  label: "Remove",
                  onPress: () => removeFromCart(r.item_id),
                }}
              />
            ))}
          </Section>
        )}

        {!loading && saved.length > 0 && (
          <Section
            icon="❤️"
            title="Saved for Later"
            sub="Bookmarked across visits"
          >
            {saved.map((r) => (
              <Row
                key={r.id}
                image={r.image_url}
                name={r.name}
                brand={r.brand}
                price={r.price}
                meta={r.store_name}
                onPress={() => openSaved(r)}
              />
            ))}
          </Section>
        )}

        {!loading && activeHolds.length > 0 && (
          <Section
            icon="🛎️"
            title="In-Store Holds"
            sub="Staff is working on these"
          >
            {activeHolds.map((h) => {
              const meta =
                HOLD_STATUS[h.status] ??
                { label: h.status, color: colors.muted };
              const snap = h.item_snapshot ?? {};
              return (
                <View key={h.id} style={styles.holdCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={2}>
                      {snap.name ?? "Item"}
                    </Text>
                    {snap.brand ? (
                      <Text style={styles.cardBrand}>{snap.brand}</Text>
                    ) : null}
                    <View style={styles.cardFooter}>
                      {snap.price != null && (
                        <Text style={styles.cardPrice}>
                          ${Number(snap.price).toFixed(2)} · ×{h.quantity}
                        </Text>
                      )}
                      <View
                        style={[
                          styles.pill,
                          { backgroundColor: `${meta.color}22` },
                        ]}
                      >
                        <Text style={[styles.pillText, { color: meta.color }]}>
                          {meta.label}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </Section>
        )}

        {!loading && found.length > 0 && (
          <Section
            icon="🎯"
            title="Found in Store"
            sub="You grabbed these yourself — nice work"
          >
            {found.map((f) => (
              <View key={f.id} style={styles.foundRow}>
                <View style={styles.thumbWrap}>
                  {(() => {
                    const uri = resolveProductImageUri(f.image_url);
                    return uri ? (
                      <Image
                        source={{ uri }}
                        style={styles.thumb}
                        accessible
                        accessibilityLabel={f.name}
                      />
                    ) : (
                      <Text style={styles.thumbIcon}>🍾</Text>
                    );
                  })()}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName} numberOfLines={2}>
                    ✓ {f.name}
                  </Text>
                  {f.brand && <Text style={styles.cardBrand}>{f.brand}</Text>}
                </View>
                <TouchableOpacity
                  onPress={() => foundStore.remove(f.id)}
                  hitSlop={10}
                >
                  <Text style={styles.removeLink}>Undo</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Section>
        )}
      </ScrollView>

      {/* Export modal — text / email / QR */}
      <Modal
        visible={exportOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setExportOpen(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Take your list with you</Text>
            <Text style={styles.sheetSub}>
              Pick how you want it — we&apos;ll send it along.
            </Text>

            <TouchableOpacity style={styles.sheetBtn} onPress={handleText}>
              <Text style={styles.sheetBtnIcon}>💬</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetBtnLabel}>Text me my list</Text>
                <Text style={styles.sheetBtnSub}>
                  Opens Messages with your list ready to send
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetBtn} onPress={handleEmail}>
              <Text style={styles.sheetBtnIcon}>✉️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetBtnLabel}>Email it to me</Text>
                <Text style={styles.sheetBtnSub}>
                  Pops your mail app with the list pre-written
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.qrWrap}>
              <Text style={styles.sheetBtnLabel}>Or scan later:</Text>
              <Image source={{ uri: qrUrl }} style={styles.qr} />
              <Text style={styles.qrHint}>
                Point your phone camera here before you leave
              </Text>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setExportOpen(false)}
            >
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

// ---------- Small reusable sub-components ----------

function Section({
  icon,
  title,
  sub,
  children,
}: {
  icon: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 22 }}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <View>
          <Text style={styles.sectionTitle}>{title}</Text>
          {sub && <Text style={styles.sectionSub}>{sub}</Text>}
        </View>
      </View>
      {children}
    </View>
  );
}

function Row({
  image,
  name,
  brand,
  price,
  meta,
  onPress,
  trailingAction,
}: {
  image: string | null;
  name: string;
  brand: string | null;
  price: number | null;
  meta: string;
  onPress: () => void;
  trailingAction?: { label: string; onPress: () => void };
}) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.thumbWrap}>
        {image ? (
          <Image source={{ uri: image }} style={styles.thumb} />
        ) : (
          <Text style={styles.thumbIcon}>🍾</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardName} numberOfLines={2}>
          {name}
        </Text>
        {brand && <Text style={styles.cardBrand}>{brand}</Text>}
        <View style={styles.cardFooter}>
          {typeof price === "number" && (
            <Text style={styles.cardPrice}>${price.toFixed(2)}</Text>
          )}
          <Text style={styles.cardStore}>{meta}</Text>
        </View>
      </View>
      {trailingAction ? (
        <TouchableOpacity
          onPress={trailingAction.onPress}
          hitSlop={10}
          style={{ paddingHorizontal: 4 }}
        >
          <Text style={styles.removeLink}>{trailingAction.label}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.chev}>›</Text>
      )}
    </TouchableOpacity>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.fg,
    letterSpacing: -0.4,
  },
  sub: { fontSize: 12, color: colors.muted, marginTop: 4 },
  exportBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  exportBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  sectionIcon: { fontSize: 22 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.fg,
  },
  sectionSub: { fontSize: 11, color: colors.muted },
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
  holdCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  foundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#d1fae5",
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
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
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: "700" },
  chev: { fontSize: 26, color: colors.muted, fontWeight: "300" },
  removeLink: { color: colors.muted, fontSize: 12, fontWeight: "600" },

  // Export sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
  },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: colors.fg },
  sheetSub: { fontSize: 13, color: colors.muted, marginBottom: 6 },
  sheetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FBF7F0",
  },
  sheetBtnIcon: { fontSize: 22 },
  sheetBtnLabel: { fontSize: 15, fontWeight: "700", color: colors.fg },
  sheetBtnSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  qrWrap: {
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FBF7F0",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    marginTop: 4,
  },
  qr: { width: 200, height: 200 },
  qrHint: { fontSize: 11, color: colors.muted, textAlign: "center" },
  closeBtn: {
    alignItems: "center",
    padding: 14,
    marginTop: 4,
  },
  closeText: { color: colors.gold, fontWeight: "700", fontSize: 15 },
});
