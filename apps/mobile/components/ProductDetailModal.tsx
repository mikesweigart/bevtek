import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";

export type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  price: number | null;
  stock_qty: number;
  image_url?: string | null;
  description_short?: string | null;
  flavor_notes?: string | null;
  tasting_notes?: string | null;
  is_staff_pick?: boolean | null;
};

type Props = {
  product: Product | null;
  visible: boolean;
  onClose: () => void;
  onBackToResults: () => void;
};

export default function ProductDetailModal({
  product,
  visible,
  onClose,
  onBackToResults,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [holding, setHolding] = useState(false);
  const [found, setFound] = useState(false);

  // Check whether this product is already saved when we open.
  useEffect(() => {
    if (!product || !visible) return;
    setFound(false);
    (async () => {
      try {
        const { data } = await supabase
          .from("saved_products")
          .select("id")
          .eq("item_id", product.id)
          .maybeSingle();
        setSaved(!!data);
      } catch {
        setSaved(false);
      }
    })();
  }, [product, visible]);

  if (!product) return null;

  async function handleSave() {
    if (!product) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("toggle_save", {
        p_item_id: product.id,
      });
      if (error) throw error;
      const nowSaved = (data as { saved?: boolean } | null)?.saved ?? false;
      setSaved(nowSaved);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't save";
      Alert.alert(
        "Sign in to save",
        "Saving products requires an account. " + msg,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleHold() {
    if (!product) return;
    setHolding(true);
    try {
      const { data, error } = await supabase.rpc("request_hold_authed", {
        p_item_id: product.id,
        p_quantity: 1,
        p_notes: "Saved from Gabby guided flow",
      });
      if (error) throw error;
      Alert.alert(
        "Hold requested ✓",
        `Our team has been notified to pull "${product.name}" for you. You'll see it on your Holds tab.`,
        [{ text: "OK", onPress: onClose }],
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't place hold";
      Alert.alert(
        "Sign in to hold",
        "Holding a product requires an account so the team knows who to reach. " +
          msg,
      );
    } finally {
      setHolding(false);
    }
  }

  function handleFound() {
    setFound(true);
    // Client-side acknowledgment — no DB write needed for now. In v2 we'll
    // log this to analytics to power "most-found-via-guided-flow" reports.
    setTimeout(() => {
      Alert.alert(
        "Nice find! 🎉",
        "Happy to help you discover this one.",
        [{ text: "Back to results", onPress: onBackToResults }],
      );
    }, 150);
  }

  const priceText =
    typeof product.price === "number" ? `$${product.price.toFixed(2)}` : null;
  const stockText =
    product.stock_qty > 5
      ? "In stock"
      : product.stock_qty > 0
        ? `Only ${product.stock_qty} left`
        : "Out of stock";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.closeText}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Product details</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} hitSlop={10}>
            <Text style={[styles.saveIcon, saved && styles.saveIconActive]}>
              {saving ? "…" : saved ? "❤️ Saved" : "♡ Save"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Label image */}
          <View style={styles.imageWrap}>
            {product.image_url ? (
              <Image
                source={{ uri: product.image_url }}
                style={styles.image}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderIcon}>🍾</Text>
                <Text style={styles.imagePlaceholderText}>
                  Label image coming soon
                </Text>
              </View>
            )}
            {product.is_staff_pick && (
              <View style={styles.pickBadge}>
                <Text style={styles.pickText}>★ Staff pick</Text>
              </View>
            )}
          </View>

          {/* Name + brand */}
          <Text style={styles.name}>{product.name}</Text>
          {product.brand && <Text style={styles.brand}>{product.brand}</Text>}

          {/* Price + stock strip */}
          <View style={styles.priceRow}>
            {priceText && <Text style={styles.price}>{priceText}</Text>}
            <Text
              style={[
                styles.stock,
                product.stock_qty === 0 && { color: "#991B1B" },
              ]}
            >
              {stockText}
            </Text>
          </View>

          {/* Description */}
          {(product.description_short ||
            product.flavor_notes ||
            product.tasting_notes) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>About</Text>
              <Text style={styles.body}>
                {product.description_short ||
                  product.flavor_notes ||
                  product.tasting_notes}
              </Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryAction, holding && { opacity: 0.6 }]}
              onPress={handleHold}
              disabled={holding || product.stock_qty === 0}
              activeOpacity={0.85}
            >
              {holding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.actionIcon}>🛎️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.primaryActionTitle}>
                      Hold this for me
                    </Text>
                    <Text style={styles.primaryActionSub}>
                      Staff will pull it from the shelf and text when it&apos;s ready
                    </Text>
                  </View>
                  <Text style={styles.actionArrow}>›</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryAction, found && styles.foundAction]}
              onPress={handleFound}
              activeOpacity={0.85}
            >
              <Text style={styles.actionIcon}>{found ? "✅" : "🎯"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.secondaryActionTitle}>
                  {found ? "Marked as found" : "I found it in store"}
                </Text>
                <Text style={styles.secondaryActionSub}>
                  Let us know you grabbed it — we&apos;ll learn what you love
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tertiaryAction}
              onPress={onBackToResults}
              activeOpacity={0.85}
            >
              <Text style={styles.actionIcon}>↺</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.tertiaryActionTitle}>
                  Show me more options
                </Text>
                <Text style={styles.tertiaryActionSub}>
                  Back to the results list
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FBF7F0" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: "#fff",
  },
  closeText: { color: colors.muted, fontSize: 14, fontWeight: "500" },
  topTitle: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.muted,
    fontWeight: "700",
  },
  saveIcon: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  saveIconActive: { color: "#B91C1C" },
  scroll: { padding: 16, paddingBottom: 48 },
  imageWrap: {
    backgroundColor: "#fff",
    borderRadius: 16,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    position: "relative",
  },
  image: { width: "100%", height: "100%" },
  imagePlaceholder: { alignItems: "center", gap: 8 },
  imagePlaceholderIcon: { fontSize: 52 },
  imagePlaceholderText: { color: colors.muted, fontSize: 13 },
  pickBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pickText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.fg,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  brand: { fontSize: 14, color: colors.muted, marginTop: 4 },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  price: { fontSize: 22, fontWeight: "800", color: colors.gold },
  stock: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  section: { marginTop: 18 },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.muted,
    fontWeight: "700",
    marginBottom: 6,
  },
  body: { fontSize: 14, color: colors.fg, lineHeight: 21 },
  actions: { marginTop: 24, gap: 10 },
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.gold,
  },
  primaryActionTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  primaryActionSub: { color: "#fff", opacity: 0.85, fontSize: 12, marginTop: 2 },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  foundAction: { borderColor: "#16A34A", backgroundColor: "#F0FDF4" },
  secondaryActionTitle: { fontSize: 15, fontWeight: "700", color: colors.fg },
  secondaryActionSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  tertiaryAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "transparent",
  },
  tertiaryActionTitle: { fontSize: 14, fontWeight: "600", color: colors.fg },
  tertiaryActionSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  actionIcon: { fontSize: 22 },
  actionArrow: { color: "#fff", fontSize: 22, fontWeight: "300" },
});
