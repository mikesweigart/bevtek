import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Image, Dimensions, FlatList, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";
import { levelForStars, CATEGORY_BADGES } from "../lib/levels";
import { getModuleImage } from "../lib/images";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = SCREEN_W * 0.6;

type Module = { id: string; title: string; description: string | null; category_group: string | null; star_reward: number; duration_minutes: number | null };
type Progress = { module_id: string; status: string; stars_earned: number };

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const [game, setGame] = useState({ total_stars: 0, current_streak_days: 0 });
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Map<string, Progress>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [store, setStore] = useState<{ name: string | null; logo_url: string | null } | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [gameRes, modRes, progRes, storeRes] = await Promise.all([
      supabase.from("user_gamification").select("total_stars, current_streak_days").eq("id", user.id).maybeSingle(),
      supabase.from("modules").select("id, title, description, category_group, star_reward, duration_minutes").eq("is_published", true).order("category_group").order("position"),
      supabase.from("progress").select("module_id, status, stars_earned").eq("user_id", user.id),
      supabase.from("users").select("stores(name, logo_url)").eq("id", user.id).maybeSingle(),
    ]);
    if (gameRes.data) setGame(gameRes.data);
    setModules((modRes.data as Module[]) ?? []);
    const map = new Map<string, Progress>();
    for (const p of (progRes.data as Progress[]) ?? []) map.set(p.module_id, p);
    setProgress(map);
    const s = (storeRes.data as { stores: { name: string | null; logo_url: string | null } | null } | null)?.stores ?? null;
    setStore(s);
  }, []);

  useEffect(() => { load(); }, [load]);

  const level = levelForStars(game.total_stars);
  const completedCount = Array.from(progress.values()).filter((p) => p.status === "completed").length;
  const featured = modules.slice(0, 8);
  const categoryStats = (() => {
    const counts = new Map<string, { total: number; done: number }>();
    for (const m of modules) {
      const cat = m.category_group ?? "other";
      const cur = counts.get(cat) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (progress.get(m.id)?.status === "completed") cur.done += 1;
      counts.set(cat, cur);
    }
    return Array.from(counts.entries()).map(([cat, c]) => ({ cat, ...c }));
  })();

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />}>

      <View style={s.header}>
        {store?.logo_url ? (
          <Image source={{ uri: store.logo_url }} style={s.storeLogo} resizeMode="contain" />
        ) : (
          <Text style={s.storeName} numberOfLines={1}>{store?.name ?? ""}</Text>
        )}
        <Text style={s.poweredBy}>Powered by BevTek.ai</Text>
      </View>

      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Pick up where you left off</Text>
          <TouchableOpacity onPress={() => nav.navigate("Explore", { initialFilter: "all" })}>
            <Text style={s.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <FlatList horizontal showsHorizontalScrollIndicator={false} data={featured} keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingRight: 20 }}
          renderItem={({ item: m }) => {
            const done = progress.get(m.id)?.status === "completed";
            const badge = CATEGORY_BADGES[m.category_group ?? "spirits"];
            const img = getModuleImage(m.title, m.category_group);
            return (
              <TouchableOpacity activeOpacity={0.85} style={s.featCard} onPress={() => nav.navigate("Explore", { moduleId: m.id })}>
                <Image source={{ uri: img }} style={s.featImage} resizeMode="cover" />
                <View style={s.featOverlay}>
                  {badge && <View style={[s.catBadge, { backgroundColor: badge.bg }]}><Text style={[s.catBadgeText, { color: badge.color }]}>{badge.label}</Text></View>}
                  {m.duration_minutes && <View style={s.durBadge}><Text style={s.durText}>⏱ {m.duration_minutes} min</Text></View>}
                </View>
                {done && <View style={s.doneBadge}><Text style={s.doneText}>⭐ Done</Text></View>}
                <View style={s.featInfo}>
                  <Text style={s.featTitle} numberOfLines={1}>{m.title}</Text>
                  {m.description && <Text style={s.featDesc} numberOfLines={1}>{m.description}</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <View style={s.levelCard}>
        <View style={s.levelTop}>
          <View>
            <Text style={s.levelLabel}>Level {level.index + 1}</Text>
            <Text style={s.levelName}>{level.name}</Text>
          </View>
          <View style={s.starsChip}><Text style={s.starsText}>⭐ {game.total_stars}</Text></View>
        </View>
        <Text style={s.levelSub}>{completedCount} module{completedCount === 1 ? "" : "s"} completed</Text>
        {level.nextMinStars !== null && (
          <View style={s.progressBar}><View style={[s.progressFill, { width: `${Math.round(level.progressToNext * 100)}%` }]} /></View>
        )}
      </View>

      {categoryStats.length > 0 && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Browse by category</Text>
            <TouchableOpacity onPress={() => nav.navigate("Explore", { initialFilter: "all" })}>
              <Text style={s.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={s.catGrid}>
            {categoryStats.map(({ cat, total, done }) => {
              const badge = CATEGORY_BADGES[cat];
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <TouchableOpacity
                  key={cat}
                  activeOpacity={0.85}
                  onPress={() => nav.navigate("Explore", { initialFilter: cat })}
                  style={s.catTile}
                >
                  <View style={[s.catAccent, { backgroundColor: badge?.bg ?? "#FBF7F0" }]}>
                    <Text style={[s.catAccentText, { color: badge?.color ?? colors.gold }]}>
                      {(badge?.label ?? cat).slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={s.catName}>{badge?.label ?? cat}</Text>
                  <Text style={s.catCount}>
                    {done}/{total} complete
                  </Text>
                  <View style={s.catProgressBg}>
                    <View style={[s.catProgressFill, { width: `${pct}%` }]} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <TouchableOpacity activeOpacity={0.85} style={s.leaderCard} onPress={() => nav.navigate("Leaderboard")}>
        <View style={{ flex: 1 }}>
          <Text style={s.leaderLabel}>TEAM</Text>
          <Text style={s.leaderTitle}>See the leaderboard</Text>
          <Text style={s.leaderSub}>Where you rank this week</Text>
        </View>
        <Text style={s.leaderChevron}>›</Text>
      </TouchableOpacity>

      {game.current_streak_days > 0 && (
        <View style={s.streakCard}><Text style={s.streakIcon}>🔥</Text><Text style={s.streakText}>{game.current_streak_days} day streak — keep it going!</Text></View>
      )}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 60 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  storeLogo: { width: 120, height: 40 },
  storeName: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3, maxWidth: "60%" },
  poweredBy: { fontSize: 11, letterSpacing: 1, color: colors.muted, fontWeight: "600" },
  levelCard: { borderWidth: 2, borderColor: colors.gold, borderRadius: 16, padding: 18, marginBottom: 32, marginTop: 4, backgroundColor: "#FBF7F0" },
  levelTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  levelLabel: { fontSize: 11, letterSpacing: 1.5, color: colors.muted, textTransform: "uppercase" },
  levelName: { fontSize: 22, fontWeight: "700", marginTop: 2 },
  starsChip: { backgroundColor: colors.gold, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  starsText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  levelSub: { fontSize: 12, color: colors.muted, marginTop: 8 },
  progressBar: { height: 5, backgroundColor: "#E5E7EB", borderRadius: 3, marginTop: 10, overflow: "hidden" },
  progressFill: { height: "100%" as any, backgroundColor: colors.gold, borderRadius: 3 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  sectionCount: { fontSize: 14, color: colors.muted },
  seeAll: { fontSize: 13, color: colors.gold, fontWeight: "600" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  catTile: {
    width: (SCREEN_W - 40 - 10) / 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 11,
    backgroundColor: "#fff",
  },
  catAccent: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  catAccentText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  catName: { fontSize: 13, fontWeight: "700", color: colors.fg },
  catCount: { fontSize: 10, color: colors.muted, marginTop: 1 },
  catProgressBg: { height: 3, backgroundColor: "#F3F4F6", borderRadius: 2, marginTop: 8, overflow: "hidden" },
  catProgressFill: { height: "100%" as any, backgroundColor: colors.gold, borderRadius: 2 },
  featCard: { width: CARD_W, marginRight: 12, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  featImage: { width: "100%", height: CARD_W * 0.6, backgroundColor: "#F3F4F6" },
  featOverlay: { position: "absolute", top: 10, left: 10, flexDirection: "row", gap: 6 },
  catBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  catBadgeText: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  durBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "rgba(0,0,0,0.5)" },
  durText: { fontSize: 9, fontWeight: "600", color: "#fff" },
  doneBadge: { position: "absolute", top: 10, right: 10, backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  doneText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  featInfo: { padding: 12 },
  featTitle: { fontSize: 15, fontWeight: "700" },
  featDesc: { fontSize: 12, color: colors.muted, marginTop: 2 },
  leaderCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#111111", borderRadius: 16, padding: 18, marginBottom: 16 },
  leaderLabel: { fontSize: 10, letterSpacing: 2, color: colors.gold, fontWeight: "700" },
  leaderTitle: { fontSize: 17, fontWeight: "700", color: "#fff", marginTop: 4 },
  leaderSub: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  leaderChevron: { fontSize: 32, color: colors.gold, fontWeight: "300", marginLeft: 10 },
  streakCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FBF7F0", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.gold },
  streakIcon: { fontSize: 20 },
  streakText: { fontSize: 13, fontWeight: "600", color: colors.gold },
});
