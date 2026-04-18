import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../lib/theme";
import { setAgeConfirmed, type AgeGateState } from "../lib/ageGate";

/**
 * Full-screen age gate shown before any shopping content. Required for
 * alcohol-retail compliance. The "Under 21" path doesn't hard-kill the
 * app — it shows a polite terminal screen so minors don't just reload
 * and click 21+. TTL is 30 days; persisted via expo-secure-store.
 */
export default function AgeGateScreen({
  state,
  onChange,
}: {
  state: AgeGateState;
  onChange: (next: AgeGateState) => void;
}) {
  async function confirm() {
    await setAgeConfirmed(true);
    onChange("confirmed");
  }

  async function deny() {
    await setAgeConfirmed(false);
    onChange("denied");
  }

  if (state === "denied") {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.inner}>
          <Text style={styles.brand}>BevTek</Text>
          <Text style={styles.title}>Sorry — you must be 21+</Text>
          <Text style={styles.body}>
            BevTek is a beverage-alcohol marketplace. Come back and visit us
            when you&apos;re of legal drinking age.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.inner}>
        <Text style={styles.brand}>BevTek</Text>
        <Text style={styles.title}>Are you 21 or older?</Text>
        <Text style={styles.body}>
          You must be of legal drinking age to browse beer, wine, and spirits
          on BevTek. Please drink responsibly.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          onPress={confirm}
        >
          <Text style={styles.primaryText}>Yes, I&apos;m 21 or older</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          onPress={deny}
        >
          <Text style={styles.secondaryText}>I&apos;m under 21</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  brand: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 32,
  },
  title: {
    color: colors.fg,
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 14,
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 32,
    maxWidth: 360,
  },
  primary: {
    backgroundColor: colors.gold,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  secondary: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  secondaryText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "500",
  },
  pressed: { opacity: 0.7 },
});
