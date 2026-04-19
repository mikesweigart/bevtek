import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Linking } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";
import { levelForStars } from "../lib/levels";
import { ReportProblemModal } from "../components/ReportProblemModal";

// Same origin as the rest of the web app. Exposed via EXPO_PUBLIC_ so the
// bundler can inline it; falls back to the production host if unset.
const WEB_ORIGIN =
  process.env.EXPO_PUBLIC_WEB_ORIGIN ?? "https://bevtek-web.vercel.app";

export default function ProfileScreen() {
  const nav = useNavigation<any>();
  const [profile, setProfile] = useState<{ full_name: string | null; email: string; role: string } | null>(null);
  const [game, setGame] = useState<{ total_stars: number; current_streak_days: number; longest_streak_days: number } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // GDPR Art. 20 / CCPA right-to-know. Hits /api/account/export, which
  // returns a JSON attachment with every row we have for this user.
  // On mobile we can't "save" a file directly, so we copy the JSON text
  // into an Alert with a "Share" handoff to the OS share sheet.
  async function runExport() {
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert("Not signed in", "Sign in again and retry.");
        return;
      }
      const res = await fetch(`${WEB_ORIGIN}/api/account/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        Alert.alert(
          "Couldn't export",
          (body as { error?: string }).error ?? "Try again in a moment.",
        );
        return;
      }
      const json = await res.text();
      // Hand off to the OS share sheet so the shopper can save to Files,
      // email it to themselves, or drop it in a notes app. Dynamic import
      // so we don't pull the Share API on screens that never need it.
      const { Share } = await import("react-native");
      await Share.share({
        message: json,
        title: "BevTek account export",
      });
    } catch (e) {
      Alert.alert(
        "Couldn't export",
        e instanceof Error ? e.message : "Try again in a moment.",
      );
    } finally {
      setExporting(false);
    }
  }

  // Account deletion — required by Apple App Store Review Guideline 5.1.1(v)
  // for any app that supports signup. Uses a two-alert flow so the shopper
  // has to explicitly type-free-confirm the destructive action, then hits
  // /api/account/delete on the web backend which calls auth.admin.deleteUser
  // (cascades through public.users to every user-owned row).
  async function confirmDeleteAccount() {
    Alert.alert(
      "Delete your BevTek account?",
      "This permanently erases your saved picks, holds, Trainer progress, and sign-in. It can't be undone. Your purchase history at individual stores (if any) is kept by those stores as required by law.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you sure?",
              "Tap Delete once more to permanently erase your account.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => { void runDelete(); },
                },
              ],
            );
          },
        },
      ],
    );
  }

  async function runDelete() {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert("Not signed in", "Sign in again and retry.");
        return;
      }
      const res = await fetch(`${WEB_ORIGIN}/api/account/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert(
          "Couldn't delete account",
          (body as { error?: string }).error ??
            "Something went wrong. Email support@bevtek.ai and we'll finish this by hand.",
          [
            {
              text: "Email support",
              onPress: () => Linking.openURL("mailto:support@bevtek.ai?subject=Account%20deletion"),
            },
            { text: "OK" },
          ],
        );
        return;
      }
      // Sign out locally so the session token and any cached profile state
      // are wiped before the Alert dismisses — prevents a flash of authed
      // UI while the user navigates away.
      await supabase.auth.signOut();
      Alert.alert(
        "Account deleted",
        "Your BevTek account and all associated data have been permanently removed.",
      );
    } catch (e) {
      Alert.alert(
        "Couldn't delete account",
        e instanceof Error ? e.message : "Try again in a moment.",
      );
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [p, g] = await Promise.all([
        supabase.from("users").select("full_name, email, role").eq("id", user.id).maybeSingle(),
        supabase.from("user_gamification").select("total_stars, current_streak_days, longest_streak_days").eq("id", user.id).maybeSingle(),
      ]);
      setProfile(p.data);
      setGame(g.data);
    })();
  }, []);

  const stars = game?.total_stars ?? 0;
  const level = levelForStars(stars);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.levelCard}>
        <Text style={s.levelLabel}>Level {level.index + 1}</Text>
        <Text style={s.levelName}>{level.name}</Text>
        <Text style={s.levelStars}>⭐ {stars} total stars</Text>
        {level.nextMinStars !== null && (
          <>
            <View style={s.progressBg}><View style={[s.progressFill, { width: `${Math.round(level.progressToNext * 100)}%` }]} /></View>
            <Text style={s.progressText}>{level.nextMinStars - stars} stars to next level</Text>
          </>
        )}
      </View>

      <View style={s.statsRow}>
        <View style={s.stat}><Text style={s.statValue}>{game?.current_streak_days ?? 0}</Text><Text style={s.statLabel}>Current streak</Text></View>
        <View style={s.stat}><Text style={s.statValue}>{game?.longest_streak_days ?? 0}</Text><Text style={s.statLabel}>Best streak</Text></View>
      </View>

      <View style={s.infoSection}>
        <Text style={s.infoLabel}>Name</Text>
        <Text style={s.infoValue}>{profile?.full_name ?? "Not set"}</Text>
        <Text style={s.infoLabel}>Email</Text>
        <Text style={s.infoValue}>{profile?.email ?? "—"}</Text>
        <Text style={s.infoLabel}>Role</Text>
        <Text style={[s.infoValue, { textTransform: "capitalize" }]}>{profile?.role ?? "—"}</Text>
      </View>

      {profile?.role && profile.role !== "customer" && (
        <TouchableOpacity style={s.linkBtn} onPress={() => nav.navigate("Leaderboard")}>
          <Text style={s.linkText}>🏆  Team Leaderboard</Text>
          <Text style={s.linkChevron}>›</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={s.linkBtn} onPress={() => setReportOpen(true)}>
        <Text style={s.linkText}>🛟  Report a problem</Text>
        <Text style={s.linkChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.linkBtn} onPress={() => Linking.openURL(`${WEB_ORIGIN}/support`)}>
        <Text style={s.linkText}>❓  Help &amp; support</Text>
        <Text style={s.linkChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.linkBtn, exporting && { opacity: 0.6 }]}
        onPress={runExport}
        disabled={exporting}
      >
        <Text style={s.linkText}>
          {exporting ? "📤  Preparing export…" : "📤  Download my data"}
        </Text>
        <Text style={s.linkChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.signOutBtn} onPress={async () => { const { error } = await supabase.auth.signOut(); if (error) Alert.alert("Error", error.message); }}>
        <Text style={s.signOutText}>Sign out</Text>
      </TouchableOpacity>

      {/* Account deletion — Apple Guideline 5.1.1(v). Destructive styling so
          the shopper can't miss the weight of the action. */}
      <TouchableOpacity
        style={[s.deleteBtn, deleting && { opacity: 0.6 }]}
        onPress={confirmDeleteAccount}
        disabled={deleting}
      >
        <Text style={s.deleteText}>
          {deleting ? "Deleting…" : "Delete account"}
        </Text>
      </TouchableOpacity>

      <Text style={s.version}>BevTek.ai · Megan Trainer v1.0</Text>

      <ReportProblemModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        context={{ screen: "Profile" }}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 24 },
  levelCard: { borderWidth: 2, borderColor: colors.gold, borderRadius: 16, padding: 20, marginBottom: 24, backgroundColor: "#FBF7F0" },
  levelLabel: { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: colors.muted },
  levelName: { fontSize: 28, fontWeight: "700", marginTop: 4 },
  levelStars: { fontSize: 14, color: colors.gold, marginTop: 4 },
  progressBg: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, marginTop: 12, overflow: "hidden" },
  progressFill: { height: "100%" as any, backgroundColor: colors.gold, borderRadius: 3 },
  progressText: { fontSize: 11, color: colors.muted, marginTop: 6 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  stat: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, alignItems: "center" },
  statValue: { fontSize: 28, fontWeight: "700" },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 4 },
  infoSection: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, marginBottom: 24 },
  infoLabel: { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: colors.muted, marginTop: 12 },
  infoValue: { fontSize: 15, marginTop: 2 },
  linkBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12 },
  linkText: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.fg },
  linkChevron: { fontSize: 24, color: colors.muted, fontWeight: "300" },
  signOutBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 14, alignItems: "center", marginBottom: 12, marginTop: 12 },
  signOutText: { fontSize: 15, color: colors.muted },
  deleteBtn: { borderWidth: 1, borderColor: "#B91C1C", borderRadius: 8, paddingVertical: 14, alignItems: "center", marginBottom: 24 },
  deleteText: { fontSize: 14, color: "#B91C1C", fontWeight: "600" },
  version: { textAlign: "center", fontSize: 11, color: colors.muted, marginBottom: 32 },
});
