import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Link } from "expo-router";
import { supabase } from "../../lib/supabase";
import { colors } from "../../lib/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) Alert.alert("Error", error.message);
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.inner}>
        <Text style={s.brand}>
          BevTek<Text style={{ color: colors.gold }}>.ai</Text>
        </Text>
        <Text style={s.heading}>Sign in</Text>
        <Text style={s.sub}>Welcome back.</Text>

        <TextInput
          style={s.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          secureTextEntry
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
          placeholderTextColor={colors.muted}
        />

        <TouchableOpacity
          style={[s.button, loading && s.buttonDisabled]}
          onPress={signIn}
          disabled={loading}
        >
          <Text style={s.buttonText}>
            {loading ? "Signing in..." : "Sign in"}
          </Text>
        </TouchableOpacity>

        <View style={s.linkRow}>
          <Text style={s.linkText}>No account? </Text>
          <Link href="/(auth)/signup">
            <Text style={[s.linkText, { color: colors.fg, textDecorationLine: "underline" }]}>
              Create one
            </Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  brand: {
    fontSize: 12,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: colors.muted,
    textAlign: "center",
    marginBottom: 24,
  },
  heading: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
    color: colors.fg,
  },
  button: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  linkText: { fontSize: 14, color: colors.muted },
});
