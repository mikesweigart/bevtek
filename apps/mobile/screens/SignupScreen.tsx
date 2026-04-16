import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";

export default function SignupScreen() {
  const nav = useNavigation<any>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function signUp() {
    if (!email || !password) return;
    if (password.length < 8) { Alert.alert("Error", "Password must be at least 8 characters."); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setSent(true);
  }

  if (sent) {
    return (
      <View style={s.container}><View style={s.inner}>
        <Text style={s.heading}>Check your email</Text>
        <Text style={s.sub}>We sent a confirmation link. Click it to finish signing up.</Text>
      </View></View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.inner}>
        <Text style={s.brand}>BevTek<Text style={{ color: colors.gold }}>.ai</Text></Text>
        <Text style={s.heading}>Create your account</Text>
        <Text style={s.sub}>Start your BevTek store in minutes.</Text>
        <TextInput style={s.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} placeholderTextColor={colors.muted} />
        <TextInput style={s.input} placeholder="Password (8+ characters)" secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} placeholderTextColor={colors.muted} />
        <TouchableOpacity style={[s.button, loading && s.disabled]} onPress={signUp} disabled={loading}>
          <Text style={s.buttonText}>{loading ? "Creating..." : "Create account"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => nav.navigate("Login")} style={s.linkRow}>
          <Text style={s.linkText}>Already have an account? <Text style={{ color: colors.fg, textDecorationLine: "underline" }}>Sign in</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  brand: { fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: colors.muted, textAlign: "center", marginBottom: 24 },
  heading: { fontSize: 24, fontWeight: "600", textAlign: "center" },
  sub: { fontSize: 14, color: colors.muted, textAlign: "center", marginBottom: 24 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12, color: colors.fg },
  button: { backgroundColor: colors.gold, borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  disabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  linkRow: { alignItems: "center", marginTop: 16 },
  linkText: { fontSize: 14, color: colors.muted },
});
