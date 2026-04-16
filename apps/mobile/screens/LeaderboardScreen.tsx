import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";
import { levelForStars } from "../lib/levels";

type Entry = { id: string; total_stars: number; users: { full_name: string | null; email: string } | null };

export default function LeaderboardScreen() {
  const [leaders, setLeaders] = useState<Entry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data: profile } = await supabase.from("users").select("store_id").eq("id", user.id).maybeSingle();
    const sid = (profile as any)?.store_id;
    if (!sid) return;
    const { data } = await supabase.from("user_gamification").select("id, total_stars, users!inner(full_name, email, store_id)").eq("users.store_id", sid).order("total_stars", { ascending: false }).limit(20);
    setLeaders((data as unknown as Entry[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podiumRanks = [2, 1, 3];
  const podiumHeights = [100, 140, 80];
  const rankColors: Record<number, string> = { 1: "#C8984E", 2: "#9CA3AF", 3: "#B45309" };

  return (
    <FlatList style={s.container} data={rest} keyExtractor={(e) => e.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />}
      ListHeaderComponent={
        <>
          <Text style={s.sub}>Top performers this month</Text>
          {top3.length >= 3 && (
            <View style={s.podium}>
              {podiumOrder.map((entry, i) => {
                const rank = podiumRanks[i];
                const name = entry.users?.full_name ?? entry.users?.email?.split("@")[0] ?? "—";
                const isMe = entry.id === userId;
                const avatarSize = rank === 1 ? 64 : 52;
                return (
                  <View key={entry.id} style={[s.podiumCol, { marginTop: rank === 1 ? 0 : 20 }]}>
                    <Text style={{ fontSize: rank === 1 ? 28 : 20, marginBottom: 4 }}>👑</Text>
                    <View style={[s.avatar, { width: avatarSize, height: avatarSize, borderColor: rankColors[rank] }]}>
                      <Text style={{ fontSize: avatarSize * 0.35, fontWeight: "700", color: colors.fg }}>{name.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <Text style={s.podiumName} numberOfLines={1}>{name}{isMe ? " (you)" : ""}</Text>
                    <Text style={s.podiumStars}>⭐ {entry.total_stars}</Text>
                    <View style={[s.podiumBar, { height: podiumHeights[i], backgroundColor: rankColors[rank] }]}>
                      <View style={[s.rankBadge, { backgroundColor: rankColors[rank] }]}>
                        <Text style={s.rankText}>#{rank}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {top3.length > 0 && top3.length < 3 && (
            <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
              {top3.map((e, i) => (
                <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", width: 30 }}>#{i + 1}</Text>
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: "600" }}>{e.users?.full_name ?? e.users?.email ?? "—"}</Text>
                  <Text style={{ fontSize: 14, color: colors.gold, fontWeight: "600" }}>⭐ {e.total_stars}</Text>
                </View>
              ))}
            </View>
          )}
          {rest.length > 0 && <View style={s.restHeader}><Text style={s.restHeaderText}>Everyone else</Text></View>}
        </>
      }
      renderItem={({ item, index }) => {
        const rank = index + 4;
        const name = item.users?.full_name ?? item.users?.email?.split("@")[0] ?? "—";
        const isMe = item.id === userId;
        const level = levelForStars(item.total_stars);
        return (
          <View style={[s.row, isMe && s.rowMe]}>
            <Text style={s.rowRank}>#{rank}</Text>
            <View style={s.rowAvatar}><Text style={s.rowAvatarText}>{name.slice(0, 2).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowName}>{name}{isMe ? <Text style={{ color: colors.gold }}> (you)</Text> : null}</Text>
              <Text style={s.rowMeta}>{level.name}</Text>
            </View>
            <Text style={s.rowStars}>⭐ {item.total_stars}</Text>
          </View>
        );
      }}
      ListEmptyComponent={top3.length === 0 ? <View style={s.empty}><Text style={s.emptyText}>No activity yet. Complete a quiz to appear!</Text></View> : null}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sub: { fontSize: 13, color: colors.muted, paddingHorizontal: 20, paddingTop: 8, marginBottom: 16 },
  podium: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 20, marginBottom: 24, gap: 8 },
  podiumCol: { alignItems: "center", flex: 1 },
  avatar: { borderRadius: 50, borderWidth: 3, alignItems: "center", justifyContent: "center", backgroundColor: "#FBF7F0", marginBottom: 6 },
  podiumName: { fontSize: 12, fontWeight: "700", textAlign: "center", maxWidth: 80 },
  podiumStars: { fontSize: 11, color: colors.gold, fontWeight: "600", marginTop: 2, marginBottom: 6 },
  podiumBar: { width: "100%", borderTopLeftRadius: 8, borderTopRightRadius: 8, alignItems: "center", justifyContent: "flex-end", paddingBottom: 8, minWidth: 60 },
  rankBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  rankText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  restHeader: { paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  restHeaderText: { fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: colors.muted, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  rowMe: { backgroundColor: "#FBF7F0" },
  rowRank: { fontSize: 13, fontWeight: "600", color: colors.muted, width: 28 },
  rowAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  rowAvatarText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  rowName: { fontSize: 14, fontWeight: "700" },
  rowMeta: { fontSize: 11, color: colors.muted, marginTop: 1 },
  rowStars: { fontSize: 14, fontWeight: "700", color: colors.gold },
  empty: { alignItems: "center", padding: 40 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: "center" },
});
