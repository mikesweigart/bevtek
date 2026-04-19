import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";
import { foundStore } from "../lib/foundStore";
import { resolveProductImageUri } from "../lib/images";

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

type Channel = "sms" | "email";

export default function ProductDetailModal({
  product,
  visible,
  onClose,
  onBackToResults,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [addingCart, setAddingCart] = useState(false);
  const [inCart, setInCart] = useState<boolean>(false);
  const [found, setFound] = useState(false);
  const [holdStep, setHoldStep] = useState<"idle" | "confirm" | "contact" | "sending" | "done">(
    "idle",
  );
  const [channel, setChannel] = useState<Channel>("sms");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // Flip to true if the remote image 404s / times out so we can fall back
  // to the "coming soon" card instead of a silent broken-image box.
  const [imageBroken, setImageBroken] = useState(false);

  // Refresh save/cart state each time we open + prefill hold contact
  // prefs from the shopper's previous hold so repeat requests are
  // literally two taps (confirm → "use these details").
  useEffect(() => {
    if (!product || !visible) return;
    setFound(false);
    setHoldStep("idle");
    setImageBroken(false);
    (async () => {
      try {
        const [saveRes, cartRes, prefRes] = await Promise.all([
          supabase
            .from("saved_products")
            .select("id")
            .eq("item_id", product.id)
            .maybeSingle(),
          supabase
            .from("cart_items")
            .select("id")
            .eq("item_id", product.id)
            .maybeSingle(),
          supabase.rpc("my_hold_preferences"),
        ]);
        setSaved(!!saveRes.data);
        setInCart(!!cartRes.data);
        const prefs = (prefRes.data ?? null) as {
          notify_channel?: "sms" | "email" | "both" | null;
          phone?: string | null;
          email?: string | null;
        } | null;
        if (prefs) {
          // "both" collapses to "sms" for the two-pill UI — shopper can
          // toggle to email if they want. Respect explicit single values.
          if (prefs.notify_channel === "email") setChannel("email");
          else if (prefs.notify_channel === "sms") setChannel("sms");
          if (prefs.phone) setPhone(prefs.phone);
          if (prefs.email) setEmail(prefs.email);
        }
      } catch {
        setSaved(false);
        setInCart(false);
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
      setSaved((data as { saved?: boolean } | null)?.saved ?? false);
    } catch (e) {
      Alert.alert(
        "Sign in to save",
        "Saving products requires an account. " +
          (e instanceof Error ? e.message : ""),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAddToCart() {
    if (!product) return;
    setAddingCart(true);
    try {
      if (inCart) {
        const { error } = await supabase.rpc("remove_from_cart", {
          p_item_id: product.id,
        });
        if (error) throw error;
        setInCart(false);
      } else {
        const { error } = await supabase.rpc("add_to_cart", {
          p_item_id: product.id,
          p_quantity: 1,
        });
        if (error) throw error;
        setInCart(true);
      }
    } catch (e) {
      Alert.alert(
        "Couldn't update cart",
        e instanceof Error ? e.message : "Try again in a moment.",
      );
    } finally {
      setAddingCart(false);
    }
  }

  async function submitHold() {
    if (!product) return;
    if (channel === "sms" && !phone.trim()) {
      Alert.alert("Phone required", "Enter a phone number so we can text you.");
      return;
    }
    if (channel === "email" && !email.trim()) {
      Alert.alert("Email required", "Enter an email so we can reach you.");
      return;
    }
    setHoldStep("sending");
    try {
      const { error } = await supabase.rpc("request_hold_v2", {
        p_item_id: product.id,
        p_notify_channel: channel,
        p_phone: channel === "sms" ? phone.trim() : null,
        p_email: channel === "email" ? email.trim() : null,
        p_quantity: 1,
        p_notes: "From Gabby guided flow",
      });
      if (error) throw error;
      setHoldStep("done");
    } catch (e) {
      setHoldStep("contact");
      Alert.alert(
        "Couldn't place hold",
        e instanceof Error ? e.message : "Try again in a moment.",
      );
    }
  }

  function handleFound() {
    setFound(true);
    // Push into the session-scoped found list so My List's "🎯 Found in
    // Store" section lights up immediately — no round-trip needed.
    if (product) {
      foundStore.add({
        id: product.id,
        name: product.name,
        brand: product.brand,
        price: product.price,
        image_url: product.image_url ?? null,
      });
    }
    setTimeout(() => {
      Alert.alert(
        "Nice find! 🎉",
        "Added to your list under Found in Store.",
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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
          {/* Label image — resolveProductImageUri strips the relative "coming
              soon" sentinel the enrichment pipeline writes, so we show the
              nicer placeholder card instead of a broken Image box. */}
          <View style={styles.imageWrap}>
            {(() => {
              const uri = resolveProductImageUri(product.image_url);
              if (uri && !imageBroken) {
                return (
                  <Image
                    source={{ uri }}
                    style={styles.image}
                    resizeMode="contain"
                    accessible
                    accessibilityLabel={`${product.brand ? product.brand + " " : ""}${product.name} label`}
                    onError={() => setImageBroken(true)}
                  />
                );
              }
              return (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderIcon}>🍾</Text>
                  <Text style={styles.imagePlaceholderText}>
                    Label image coming soon
                  </Text>
                </View>
              );
            })()}
            {product.is_staff_pick && (
              <View style={styles.pickBadge}>
                <Text style={styles.pickText}>★ Staff pick</Text>
              </View>
            )}
          </View>

          <Text style={styles.name}>{product.name}</Text>
          {product.brand && <Text style={styles.brand}>{product.brand}</Text>}

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
            {/* Primary: Hold */}
            <TouchableOpacity
              style={[styles.primaryAction, product.stock_qty === 0 && { opacity: 0.5 }]}
              onPress={() => setHoldStep("confirm")}
              disabled={product.stock_qty === 0}
              activeOpacity={0.85}
            >
              <Text style={styles.actionIcon}>🛎️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.primaryActionTitle}>
                  Request In-Store Hold
                </Text>
                <Text style={styles.primaryActionSub}>
                  We&apos;ll hold it at the front for 24 hours
                </Text>
              </View>
              <Text style={styles.actionArrow}>›</Text>
            </TouchableOpacity>

            {/* Add to Cart */}
            <TouchableOpacity
              style={[styles.secondaryAction, inCart && styles.cartedAction]}
              onPress={handleAddToCart}
              disabled={addingCart}
              activeOpacity={0.85}
            >
              <Text style={styles.actionIcon}>🛒</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.secondaryActionTitle}>
                  {inCart ? "In your Cart ✓" : "Add to Virtual Cart"}
                </Text>
                <Text style={styles.secondaryActionSub}>
                  {inCart
                    ? "Tap to remove from Cart"
                    : "For items you're considering"}
                </Text>
              </View>
              {addingCart && <ActivityIndicator size="small" color={colors.gold} />}
            </TouchableOpacity>

            {/* Found in store */}
            <TouchableOpacity
              style={[styles.secondaryAction, found && styles.foundAction]}
              onPress={handleFound}
              activeOpacity={0.85}
            >
              <Text style={styles.actionIcon}>{found ? "✅" : "🎯"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.secondaryActionTitle}>
                  {found ? "Marked as found" : "I found it in the store"}
                </Text>
                <Text style={styles.secondaryActionSub}>
                  Great — we&apos;ll remember this one
                </Text>
              </View>
            </TouchableOpacity>

            {/* Back to results */}
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

            {/* Not interested */}
            <TouchableOpacity
              style={styles.dismissAction}
              onPress={onClose}
              activeOpacity={0.6}
            >
              <Text style={styles.dismissText}>Not interested</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Hold flow dialogs — inline overlays so keyboard handling is tidy */}
        {holdStep === "confirm" && (
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>
                Hold this item in the store?
              </Text>
              <Text style={styles.sheetBody}>
                We&apos;ll hold it at the front for 24 hours and let you know
                when it&apos;s ready for pickup.
              </Text>
              <TouchableOpacity
                style={styles.sheetPrimary}
                onPress={() => setHoldStep("contact")}
              >
                <Text style={styles.sheetPrimaryText}>Yes, hold it</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sheetCancel}
                onPress={() => setHoldStep("idle")}
              >
                <Text style={styles.sheetCancelText}>No, go back</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {holdStep === "contact" && (
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>How should we reach you?</Text>
              <Text style={styles.sheetBody}>
                So we can tell you the moment it&apos;s ready.
              </Text>
              <View style={styles.channelRow}>
                <TouchableOpacity
                  style={[
                    styles.channelPill,
                    channel === "sms" && styles.channelPillActive,
                  ]}
                  onPress={() => setChannel("sms")}
                >
                  <Text
                    style={[
                      styles.channelLabel,
                      channel === "sms" && styles.channelLabelActive,
                    ]}
                  >
                    📱 Text me
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.channelPill,
                    channel === "email" && styles.channelPillActive,
                  ]}
                  onPress={() => setChannel("email")}
                >
                  <Text
                    style={[
                      styles.channelLabel,
                      channel === "email" && styles.channelLabelActive,
                    ]}
                  >
                    ✉️ Email me
                  </Text>
                </TouchableOpacity>
              </View>
              {channel === "sms" ? (
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="(555) 555-5555"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  style={styles.input}
                  autoFocus
                />
              ) : (
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@email.com"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                  autoFocus
                />
              )}
              <TouchableOpacity
                style={styles.sheetPrimary}
                onPress={submitHold}
              >
                <Text style={styles.sheetPrimaryText}>Confirm Hold Request</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sheetCancel}
                onPress={() => setHoldStep("idle")}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {holdStep === "sending" && (
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <ActivityIndicator color={colors.gold} />
              <Text style={[styles.sheetBody, { marginTop: 14 }]}>
                Sending your request...
              </Text>
            </View>
          </View>
        )}

        {holdStep === "done" && (
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <Text style={styles.sheetIcon}>🎉</Text>
              <Text style={styles.sheetTitle}>Hold requested ✓</Text>
              <Text style={styles.sheetBody}>
                Our team is on it. We&apos;ll let you know the moment &ldquo;
                {product.name}&rdquo; is up front.
              </Text>
              <TouchableOpacity style={styles.sheetPrimary} onPress={onClose}>
                <Text style={styles.sheetPrimaryText}>See my holds</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sheetCancel}
                onPress={onBackToResults}
              >
                <Text style={styles.sheetCancelText}>Keep shopping</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
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
  cartedAction: { borderColor: colors.gold, backgroundColor: "#FBF7F0" },
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
  dismissAction: {
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  dismissText: { color: colors.muted, fontSize: 13, fontWeight: "500" },
  actionIcon: { fontSize: 22 },
  actionArrow: { color: "#fff", fontSize: 22, fontWeight: "300" },

  // Hold confirmation overlay
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 22,
    width: "100%",
    maxWidth: 420,
    gap: 6,
  },
  sheetIcon: { fontSize: 40, textAlign: "center", marginBottom: 2 },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.fg,
    letterSpacing: -0.3,
  },
  sheetBody: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  sheetPrimary: {
    marginTop: 12,
    backgroundColor: colors.gold,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  sheetPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  sheetCancel: { paddingVertical: 10, alignItems: "center" },
  sheetCancelText: { color: colors.muted, fontSize: 14, fontWeight: "500" },

  channelRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  channelPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  channelPillActive: {
    borderColor: colors.gold,
    backgroundColor: "#FBF7F0",
  },
  channelLabel: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  channelLabelActive: { color: colors.gold },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.fg,
    backgroundColor: "#fff",
  },
});
