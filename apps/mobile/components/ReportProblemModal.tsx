import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";
import appJson from "../app.json";

const WEB_BASE =
  process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://bevtek-web.vercel.app";

type Severity = "low" | "normal" | "high" | "urgent";

export type ReportProblemContext = {
  /** Short human-readable last-thing the user did. */
  lastAction?: string | null;
  /** Current screen / route name. */
  screen?: string | null;
  /** Free-form JSON snapshot — recent messages, prompt versions, etc. */
  extra?: Record<string, unknown> | null;
};

/**
 * Report-a-Problem modal. Always available from the profile screen and
 * optionally passed extra context (last Gabby turns, current screen).
 *
 * Auth-aware: signed-in users hit the endpoint with the Supabase
 * session; anonymous users (shopper storefront) would use the same
 * endpoint with reporter_email supplied. We always attach app_version
 * + user_agent so triage has machine context.
 */
export function ReportProblemModal({
  visible,
  onClose,
  context,
}: {
  visible: boolean;
  onClose: () => void;
  context?: ReportProblemContext;
}) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSubject("");
      setDescription("");
      setSeverity("normal");
      setError(null);
      setOk(false);
      setSubmitting(false);
    }
  }, [visible]);

  const submit = async () => {
    if (!subject.trim() || !description.trim()) {
      setError("Please fill in both fields.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token ?? null;
      // Pulled from app.json at bundle time — bumps automatically when you
      // edit expo.version there, no separate env var to maintain.
      const appVersion = appJson.expo.version ?? "dev";

      const res = await fetch(`${WEB_BASE}/api/support/ticket`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim(),
          severity,
          surface: "mobile",
          screen: context?.screen ?? null,
          app_version: appVersion,
          last_action: context?.lastAction ?? null,
          context_json: context?.extra ?? null,
        }),
      });
      const j = await res.json().catch(() => ({}) as { error?: string });
      if (!res.ok) {
        setError(j.error ?? `Error ${res.status}`);
        return;
      }
      setOk(true);
      // Let the user see "Thanks" for a beat before dismissing.
      setTimeout(() => onClose(), 1200);
    } catch (e) {
      setError((e as Error).message ?? "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={s.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={s.backdropPress} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>Report a problem</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
              <Text style={s.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.subtitle}>
            Tell us what happened and we&apos;ll look into it. The more
            detail the better.
          </Text>

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {ok ? (
              <View style={s.okBox}>
                <Text style={s.okTitle}>Thanks — we got it.</Text>
                <Text style={s.okBody}>
                  A manager or BevTek admin will take a look shortly.
                </Text>
              </View>
            ) : (
              <>
                <Text style={s.label}>Subject</Text>
                <TextInput
                  style={s.input}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="e.g. Gabby recommended a product we don't carry"
                  placeholderTextColor={colors.muted}
                  maxLength={200}
                />

                <Text style={s.label}>What happened?</Text>
                <TextInput
                  style={[s.input, s.textarea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Walk us through what you were doing and what went wrong."
                  placeholderTextColor={colors.muted}
                  multiline
                  maxLength={4000}
                />

                <Text style={s.label}>Severity</Text>
                <View style={s.sevRow}>
                  {(["low", "normal", "high", "urgent"] as Severity[]).map(
                    (lvl) => (
                      <TouchableOpacity
                        key={lvl}
                        onPress={() => setSeverity(lvl)}
                        style={[
                          s.sevChip,
                          severity === lvl && s.sevChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            s.sevText,
                            severity === lvl && s.sevTextActive,
                          ]}
                        >
                          {lvl}
                        </Text>
                      </TouchableOpacity>
                    ),
                  )}
                </View>

                {error ? <Text style={s.error}>{error}</Text> : null}

                <TouchableOpacity
                  style={[s.submit, submitting && s.submitDisabled]}
                  onPress={submit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={s.submitText}>Send report</Text>
                  )}
                </TouchableOpacity>
                <Text style={s.fine}>
                  We attach your app version and current screen so we can
                  reproduce it. No passwords or payment info.
                </Text>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  backdropPress: { flex: 1 },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: "92%",
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 20, fontWeight: "700", color: colors.fg },
  close: { fontSize: 22, color: colors.muted, padding: 4 },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 12 },
  scroll: { maxHeight: 560 },
  scrollContent: { paddingBottom: 24 },
  label: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.muted,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.fg,
    backgroundColor: colors.surface,
  },
  textarea: { minHeight: 120, textAlignVertical: "top" },
  sevRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  sevChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  sevChipActive: { borderColor: colors.gold, backgroundColor: "#FBF7F0" },
  sevText: { fontSize: 12, color: colors.muted, textTransform: "capitalize" },
  sevTextActive: { color: colors.gold, fontWeight: "700" },
  error: { color: "#B91C1C", marginTop: 12, fontSize: 13 },
  submit: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  fine: { fontSize: 11, color: colors.muted, marginTop: 12, textAlign: "center" },
  okBox: { padding: 24, alignItems: "center" },
  okTitle: { fontSize: 20, fontWeight: "700", color: colors.fg, marginBottom: 8 },
  okBody: { fontSize: 13, color: colors.muted, textAlign: "center" },
});
