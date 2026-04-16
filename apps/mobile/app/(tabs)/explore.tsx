import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { colors } from "../../lib/theme";
import { CATEGORY_BADGES } from "../../lib/levels";
import { getModuleImage } from "../../lib/images";

type Module = {
  id: string;
  title: string;
  description: string | null;
  category_group: string | null;
  star_reward: number;
  duration_minutes: number | null;
};
type Progress = { module_id: string; status: string; stars_earned: number };

const FILTER_ALL = "all";

export default function ExploreScreen() {
  const { user } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Map<string, Progress>>(new Map());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(FILTER_ALL);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [modRes, progRes] = await Promise.all([
      supabase.from("modules").select("id, title, description, category_group, star_reward, duration_minutes").eq("is_published", true).order("category_group").order("position"),
      supabase.from("progress").select("module_id, status, stars_earned").eq("user_id", user.id),
    ]);
    setModules((modRes.data as Module[]) ?? []);
    const map = new Map<string, Progress>();
    for (const p of (progRes.data as Progress[]) ?? []) map.set(p.module_id, p);
    setProgress(map);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Derive category list
  const categories = useMemo(() => {
    const cats = Array.from(new Set(modules.map((m) => m.category_group).filter(Boolean))) as string[];
    return [FILTER_ALL, ...cats];
  }, [modules]);

  // Filter
  const filtered = useMemo(() => {
    let list = modules;
    if (filter !== FILTER_ALL) list = list.filter((m) => m.category_group === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.title.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q));
    }
    return list;
  }, [modules, filter, search]);

  function chipLabel(key: string) {
    if (key === FILTER_ALL) return "All";
    return CATEGORY_BADGES[key]?.label ?? key;
  }

  // If a module is selected, show detail view inline
  if (selectedModule) {
    return (
      <ModuleDetail
        mod={selectedModule}
        progress={progress.get(selectedModule.id)}
        userId={user?.id ?? ""}
        onBack={() => { setSelectedModule(null); load(); }}
      />
    );
  }

  return (
    <View style={s.container}>
      <Text style={s.sub}>{filtered.length} modules available</Text>

      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          placeholder="Search modules..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categories}
        keyExtractor={(c) => c}
        style={s.chipList}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item: cat }) => {
          const active = cat === filter;
          return (
            <TouchableOpacity
              onPress={() => setFilter(cat)}
              style={[s.filterChip, active && s.filterChipActive]}
            >
              <Text style={[s.filterChipText, active && s.filterChipTextActive]}>
                {chipLabel(cat)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />
        }
        renderItem={({ item: m }) => {
          const pr = progress.get(m.id);
          const done = pr?.status === "completed";
          const badge = CATEGORY_BADGES[m.category_group ?? "spirits"];
          const img = getModuleImage(m.title, m.category_group);
          return (
            <TouchableOpacity
              style={s.moduleRow}
              activeOpacity={0.7}
              onPress={() => setSelectedModule(m)}
            >
              <Image source={{ uri: img }} style={s.moduleThumb} resizeMode="cover" />
              <View style={s.moduleInfo}>
                {badge && (
                  <View style={[s.modCatBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[s.modCatText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                )}
                <Text style={s.moduleTitle} numberOfLines={1}>{m.title}</Text>
                {m.description && <Text style={s.moduleDesc} numberOfLines={1}>{m.description}</Text>}
                <View style={s.moduleMeta}>
                  {m.duration_minutes && <Text style={s.metaText}>⏱ {m.duration_minutes} min</Text>}
                  <Text style={s.metaText}>· {m.star_reward} ⭐</Text>
                </View>
              </View>
              {done && (
                <View style={s.checkCircle}>
                  <Text style={s.checkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

// Inline module detail (same as trainer.tsx from before but adapted)
import { Alert } from "react-native";

function ModuleDetail({
  mod, progress: pr, userId, onBack,
}: { mod: Module; progress: Progress | undefined; userId: string; onBack: () => void }) {
  const [content, setContent] = useState("");
  const [quizQs, setQuizQs] = useState<Array<{ id: string; question: string; options: string[]; correct_index: number; explanation: string | null }>>([]);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [result, setResult] = useState<{ correct: number; total: number; passed: boolean; starsNew: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const img = getModuleImage(mod.title, mod.category_group);

  useEffect(() => {
    (async () => {
      const [cRes, qRes] = await Promise.all([
        supabase.from("modules").select("content").eq("id", mod.id).maybeSingle(),
        supabase.from("quiz_questions").select("id, question, options, correct_index, explanation").eq("module_id", mod.id).order("position"),
      ]);
      const c = cRes.data as { content: { body?: string } | null } | null;
      setContent(c?.content?.body ?? "");
      const qs = (qRes.data ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] }));
      setQuizQs(qs);
      setAnswers(Array(qs.length).fill(null));
      setRevealed(Array(qs.length).fill(false));
    })();
  }, [mod.id]);

  function pick(qIdx: number, oIdx: number) {
    if (revealed[qIdx]) return;
    setAnswers((a) => { const n = [...a]; n[qIdx] = oIdx; return n; });
    setRevealed((r) => { const n = [...r]; n[qIdx] = true; return n; });
  }

  async function submit() {
    if (answers.some((a) => a === null)) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("submit_quiz_attempt", { p_module_id: mod.id, p_answers: answers });
    setSubmitting(false);
    if (error) { Alert.alert("Error", error.message); return; }
    const r = data as any;
    setResult({ correct: r.correct, total: r.total, passed: r.passed, starsNew: r.stars_new });
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 20 }}
      data={[1]}
      keyExtractor={() => "detail"}
      renderItem={() => (
        <View>
          <TouchableOpacity onPress={onBack} style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>← Back</Text>
          </TouchableOpacity>

          <Image source={{ uri: img }} style={{ width: "100%", height: 200, borderRadius: 16, marginBottom: 16, backgroundColor: "#F3F4F6" }} resizeMode="cover" />

          <Text style={{ fontSize: 26, fontWeight: "700", marginBottom: 8 }}>{mod.title}</Text>
          {mod.description && <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 16 }}>{mod.description}</Text>}
          <Text style={{ fontSize: 14, lineHeight: 22, marginBottom: 32 }}>{content}</Text>

          {result ? (
            <View style={{ borderWidth: 2, borderColor: result.passed ? colors.gold : colors.border, borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 24 }}>
              {result.passed ? (
                <>
                  <Text style={{ fontSize: 40 }}>⭐</Text>
                  <Text style={{ fontSize: 24, fontWeight: "700", marginTop: 8 }}>{result.correct}/{result.total} correct</Text>
                  {result.starsNew > 0 && <Text style={{ fontSize: 16, marginTop: 4 }}>+{result.starsNew} stars earned</Text>}
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 24, fontWeight: "700" }}>{result.correct}/{result.total} correct</Text>
                  <Text style={{ fontSize: 13, color: colors.muted, marginTop: 8, textAlign: "center" }}>Review the material and try again.</Text>
                </>
              )}
              <TouchableOpacity style={{ backgroundColor: colors.gold, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, marginTop: 16 }} onPress={() => { setResult(null); setAnswers(Array(quizQs.length).fill(null)); setRevealed(Array(quizQs.length).fill(false)); }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : quizQs.length > 0 ? (
            <>
              <Text style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: colors.muted, marginBottom: 16 }}>Quick check</Text>
              {quizQs.map((q, qIdx) => (
                <View key={q.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", marginBottom: 12 }}>{q.question}</Text>
                  {q.options.map((opt: string, oIdx: number) => {
                    const picked = answers[qIdx] === oIdx;
                    const show = revealed[qIdx];
                    const correct = oIdx === q.correct_index;
                    return (
                      <TouchableOpacity key={oIdx} disabled={show} onPress={() => pick(qIdx, oIdx)}
                        style={{ borderWidth: 1, borderColor: show ? (correct ? "#16a34a" : picked ? "#dc2626" : colors.border) : picked ? colors.gold : colors.border, borderRadius: 8, padding: 12, marginBottom: 8, backgroundColor: show && correct ? "#f0fdf4" : show && picked && !correct ? "#fef2f2" : picked ? "#FBF7F0" : "transparent" }}>
                        <Text style={{ fontSize: 14 }}>{String.fromCharCode(65 + oIdx)}. {opt}{show && correct ? " ✓" : ""}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {revealed[qIdx] && q.explanation && (
                    <View style={{ backgroundColor: "#F9FAFB", borderRadius: 8, padding: 12, marginTop: 4 }}>
                      <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>{q.explanation}</Text>
                    </View>
                  )}
                </View>
              ))}
              <TouchableOpacity
                style={{ backgroundColor: colors.gold, borderRadius: 8, paddingVertical: 14, alignItems: "center", marginBottom: 32, opacity: answers.every((a) => a !== null) && !submitting ? 1 : 0.4 }}
                disabled={!answers.every((a) => a !== null) || submitting}
                onPress={submit}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{submitting ? "Submitting..." : "Submit quiz"}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sub: { paddingHorizontal: 16, paddingTop: 8, fontSize: 13, color: colors.muted },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  searchInput: { backgroundColor: "#F3F4F6", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: colors.fg },
  chipList: { maxHeight: 48, marginBottom: 4 },
  filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  filterChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  filterChipText: { fontSize: 13, fontWeight: "600", color: colors.fg },
  filterChipTextActive: { color: "#fff" },
  moduleRow: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  moduleThumb: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#F3F4F6" },
  moduleInfo: { flex: 1 },
  modCatBadge: { borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1, alignSelf: "flex-start", marginBottom: 3 },
  modCatText: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  moduleTitle: { fontSize: 15, fontWeight: "700" },
  moduleDesc: { fontSize: 12, color: colors.muted, marginTop: 1 },
  moduleMeta: { flexDirection: "row", gap: 4, marginTop: 3 },
  metaText: { fontSize: 11, color: colors.muted },
  checkCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center" },
  checkText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
