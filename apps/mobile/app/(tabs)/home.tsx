import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { colors } from "../../lib/theme";

export default function HomeScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{
    full_name: string | null;
    email: string;
    role: string;
  } | null>(null);
  const [game, setGame] = useState<{
    total_stars: number;
    current_streak_days: number;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!user) return;
    const [profileRes, gameRes] = await Promise.all([
      supabase
        .from("users")
        .select("full_name, email, role")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("user_gamification")
        .select("total_stars, current_streak_days")
        .eq("id", user.id)
        .maybeSingle(),
    ]);
    setProfile(profileRes.data);
    setGame(gameRes.data);
  }

  useEffect(() => {
    load();
  }, [user]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const name = profile?.full_name ?? "there";
  const stars = game?.total_stars ?? 0;
  const streak = game?.current_streak_days ?? 0;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.gold}
        />
      }
    >
      <Text style={s.welcome}>
        Welcome, <Text style={{ color: colors.gold }}>{name}</Text>.
      </Text>
      <Text style={s.sub}>
        {profile?.email} · {profile?.role ?? "staff"}
      </Text>

      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statIcon}>⭐</Text>
          <Text style={s.statValue}>{stars}</Text>
          <Text style={s.statLabel}>Stars</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statIcon}>🔥</Text>
          <Text style={s.statValue}>{streak}</Text>
          <Text style={s.statLabel}>Day streak</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Megan Trainer</Text>
        <Text style={s.cardDesc}>
          Master wine, spirits, beer, and cocktails with 44 bite-sized modules.
          Earn stars and climb the leaderboard.
        </Text>
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Ask Megan</Text>
        <Text style={s.cardDesc}>
          Type any question about a product, pairing, or category. Megan
          searches your store&apos;s live inventory and answers in seconds.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 24 },
  welcome: { fontSize: 28, fontWeight: "600", letterSpacing: -0.3 },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 24 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: "600" },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  cardDesc: { fontSize: 13, color: colors.muted, lineHeight: 19 },
});
