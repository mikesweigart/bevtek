import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../lib/theme";
import { setAgeConfirmed, type AgeGateState } from "../lib/ageGate";

/**
 * Full-screen age gate shown before any shopping content.
 *
 * IMPORTANT — this is NOT a yes/no button. Apple App Review (Guideline
 * 1.4.3) expects beverage-alcohol apps to collect the user's actual
 * date of birth and block anyone under the legal drinking age. A
 * self-declared "I'm 21+" checkbox is a common, avoidable rejection.
 * The DOB is calculated locally and only the boolean + timestamp are
 * stored (via expo-secure-store) so we retain no PII.
 *
 * The "Under 21" path is terminal — no "try again" link. Reviewers test
 * this by entering a minor's DOB and expecting the app to stay
 * blocked.
 *
 * TTL is 30 days to mirror web cookie semantics.
 */

const MIN_AGE = 21;

function ageFromDob(year: number, month: number, day: number): number | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (year < 1900 || year > new Date().getFullYear()) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const dob = new Date(year, month - 1, day);
  // Guard against invalid dates like Feb 30 — JS will roll them over.
  if (
    dob.getFullYear() !== year ||
    dob.getMonth() !== month - 1 ||
    dob.getDate() !== day
  ) {
    return null;
  }

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

export default function AgeGateScreen({
  state,
  onChange,
}: {
  state: AgeGateState;
  onChange: (next: AgeGateState) => void;
}) {
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(
    () => ageFromDob(parseInt(year, 10), parseInt(month, 10), parseInt(day, 10)),
    [year, month, day],
  );
  const canSubmit = parsed !== null;

  async function submit() {
    if (parsed === null) {
      setError("Please enter a valid date.");
      return;
    }
    setError(null);
    if (parsed >= MIN_AGE) {
      await setAgeConfirmed(true);
      onChange("confirmed");
    } else {
      await setAgeConfirmed(false);
      onChange("denied");
    }
  }

  if (state === "denied") {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.inner}>
          <Text style={styles.brand}>BevTek</Text>
          <Text style={styles.title}>Sorry — you must be {MIN_AGE}+</Text>
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.brand}>BevTek</Text>
          <Text style={styles.title}>What&apos;s your date of birth?</Text>
          <Text style={styles.body}>
            You must be {MIN_AGE} or older to browse beer, wine, and spirits
            on BevTek. Please drink responsibly.
          </Text>

          <View style={styles.dobRow}>
            <View style={styles.dobField}>
              <Text style={styles.dobLabel}>MM</Text>
              <TextInput
                style={styles.dobInput}
                value={month}
                onChangeText={(v) => setMonth(v.replace(/\D/g, "").slice(0, 2))}
                keyboardType="number-pad"
                placeholder="01"
                placeholderTextColor={colors.muted}
                maxLength={2}
                accessibilityLabel="Birth month"
              />
            </View>
            <View style={styles.dobField}>
              <Text style={styles.dobLabel}>DD</Text>
              <TextInput
                style={styles.dobInput}
                value={day}
                onChangeText={(v) => setDay(v.replace(/\D/g, "").slice(0, 2))}
                keyboardType="number-pad"
                placeholder="15"
                placeholderTextColor={colors.muted}
                maxLength={2}
                accessibilityLabel="Birth day"
              />
            </View>
            <View style={[styles.dobField, { flex: 1.4 }]}>
              <Text style={styles.dobLabel}>YYYY</Text>
              <TextInput
                style={styles.dobInput}
                value={year}
                onChangeText={(v) => setYear(v.replace(/\D/g, "").slice(0, 4))}
                keyboardType="number-pad"
                placeholder="1990"
                placeholderTextColor={colors.muted}
                maxLength={4}
                accessibilityLabel="Birth year"
              />
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.primary,
              (!canSubmit || pressed) && styles.pressed,
              !canSubmit && styles.primaryDisabled,
            ]}
            onPress={submit}
            disabled={!canSubmit}
          >
            <Text style={styles.primaryText}>Continue</Text>
          </Pressable>

          <Text style={styles.fineprint}>
            Your date of birth is used only to verify you&apos;re of legal
            drinking age. We do not store it — only whether you passed the
            check.
          </Text>
        </View>
      </KeyboardAvoidingView>
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
    marginBottom: 28,
    maxWidth: 360,
  },
  dobRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    maxWidth: 360,
    marginBottom: 8,
  },
  dobField: { flex: 1 },
  dobLabel: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  dobInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 18,
    textAlign: "center",
    color: colors.fg,
    backgroundColor: "#FFFFFF",
  },
  error: {
    color: "#B91C1C",
    fontSize: 13,
    marginTop: 6,
    marginBottom: 4,
    textAlign: "center",
  },
  primary: {
    backgroundColor: colors.gold,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  fineprint: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    maxWidth: 320,
    marginTop: 6,
  },
  pressed: { opacity: 0.7 },
});
