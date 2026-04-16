import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { colors } from "../../lib/theme";

const LEVELS = [
  { name: "Newcomer", min: 0 },
  { name: "Apprentice", min: 10 },
  { name: "Sommelier", min: 30 },
  { name: "Expert", min: 60 },
  { name: "Elite", min: 100 },
];

function levelForStars(stars: number) {
  let level = LEVELS[0];
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (stars >= LEVELS[i].min) {
      level = LEVELS[i];
      idx = i;
    }
  }
  const next = LEVELS[idx + 1];
  return { ...level, index: idx, nextMin: next?.min ?? null };
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{
    full_name: string | null;
    email: string;
    role: string;
  } | null>(null);
  const [game, setGame] = useState<{
    total_stars: number;
    current_streak_days: number;
    longest_streak_days: number;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from("users")
        .select("full_name, email, role")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("user_gamification")
        .select("total_stars, current_streak_days, longest_streak_days")
        .eq("id", user.id)
        .maybeSingle(),
    ]).then(([p, g]) => {
      setProfile(p.data);
      setGame(g.data);
    });
  }, [user]);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Error", error.message);
  }

  const stars = game?.total_stars ?? 0;
  const level = levelForStars(stars);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.levelCard}>
        <Text style={s.levelLabel}>Level {level.index + 1}</Text>
        <Text style={s.levelName}>{level.name}</Text>
        <Text style={s.levelStars}>⭐ {stars} total stars</Text>
        {level.nextMin !== null && (
          <>
            <View style={s.progressBg}>
              <View
                style={[
                  s.progressFill,
                  {
                    width: `${Math.round(
                      ((stars - level.min) / (level.nextMin - level.min)) * 100,
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={s.progressText}>
              {level.nextMin - stars} stars to next level
            </Text>
          </>
        )}
      </View>

      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statValue}>{game?.current_streak_days ?? 0}</Text>
          <Text style={s.statLabel}>Current streak</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statValue}>{game?.longest_streak_days ?? 0}</Text>
          <Text style={s.statLabel}>Best streak</Text>
        </View>
      </View>

      <View style={s.infoSection}>
        <Text style={s.infoLabel}>Name</Text>
        <Text style={s.infoValue}>
          {profile?.full_name ?? "Not set"}
        </Text>
        <Text style={s.infoLabel}>Email</Text>
        <Text style={s.infoValue}>{profile?.email ?? "—"}</Text>
        <Text style={s.infoLabel}>Role</Text>
        <Text style={[s.infoValue, { textTransform: "capitalize" }]}>
          {profile?.role ?? "—"}
        </Text>
      </View>

      <TouchableOpacity style={s.signOutBtn} onPress={signOut}>
        <Text style={s.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={s.version}>
        BevTek.ai · Megan Trainer v1.0
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 24 },
  levelCard: {
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    backgroundColor: "#FBF7F0",
  },
  levelLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.muted,
  },
  levelName: { fontSize: 28, fontWeight: "600", marginTop: 4 },
  levelStars: { fontSize: 14, color: colors.gold, marginTop: 4 },
  progressBg: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.gold, borderRadius: 3 },
  progressText: { fontSize: 11, color: colors.muted, marginTop: 6 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  statValue: { fontSize: 28, fontWeight: "600" },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 4 },
  infoSection: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.muted,
    marginTop: 12,
  },
  infoValue: { fontSize: 15, marginTop: 2 },
  signOutBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 24,
  },
  signOutText: { fontSize: 15, color: colors.muted },
  version: {
    textAlign: "center",
    fontSize: 11,
    color: colors.muted,
    marginBottom: 32,
  },
});
