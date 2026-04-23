/**
 * AI-generated content disclaimer (mobile).
 *
 * Mirror of apps/web/components/AIDisclaimer.tsx. Same variants, same
 * intent — reduce tort exposure and set user expectations when Gabby
 * or Megan output is rendered.
 *
 * Kept visually subtle: it's a trust-setting cue, not a wall of text.
 */

import { View, Text, StyleSheet } from "react-native";
import { colors } from "../lib/theme";

type Variant = "inline" | "banner" | "footnote";

const TEXT: Record<Variant, string> = {
  inline:
    "AI-generated. Double-check facts about stock, price, or pairings with a staff member.",
  banner:
    "This conversation is powered by AI. It may occasionally be wrong — please verify important details before relying on them.",
  footnote: "AI-generated",
};

export function AIDisclaimer({
  variant = "inline",
  style,
}: {
  variant?: Variant;
  style?: object;
}) {
  if (variant === "banner") {
    return (
      <View
        accessibilityRole="text"
        accessibilityLabel="AI disclaimer"
        style={[styles.banner, style]}
      >
        <Text style={styles.bannerText}>ⓘ {TEXT.banner}</Text>
      </View>
    );
  }

  if (variant === "footnote") {
    return (
      <Text
        accessibilityLabel="AI disclaimer"
        style={[styles.footnote, style]}
      >
        {TEXT.footnote}
      </Text>
    );
  }

  return (
    <Text
      accessibilityRole="text"
      accessibilityLabel="AI disclaimer"
      style={[styles.inline, style]}
    >
      {TEXT.inline}
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#92400e",
  },
  inline: {
    fontSize: 11,
    fontStyle: "italic",
    color: colors?.muted ?? "#737373",
    marginTop: 4,
    lineHeight: 14,
  },
  footnote: {
    fontSize: 10,
    fontStyle: "italic",
    color: colors?.muted ?? "#737373",
  },
});
