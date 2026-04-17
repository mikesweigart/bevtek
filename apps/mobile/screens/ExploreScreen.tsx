import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Image, RefreshControl, Alert, ScrollView } from "react-native";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";
import { CATEGORY_BADGES } from "../lib/levels";
import { ListenButton } from "../components/ListenButton";
import { StoreProducts } from "../components/StoreProducts";
import { ShopLink } from "../components/ShopLink";
import { QuizCelebration } from "../components/QuizCelebration";
import { getModuleImage } from "../lib/images";

type Module = { id: string; title: string; description: string | null; category_group: string | null; star_reward: number; duration_minutes: number | null };
type Progress = { module_id: string; status: string; stars_earned: number };

/** Extract search keywords from a module title + category for inventory matching */
function extractSearchTerms(title: string, categoryGroup: string | null): string[] {
  const SKIP = new Set(["the", "a", "an", "to", "and", "of", "for", "vs", "how", "around", "beyond", "guide", "basics", "essentials", "101", "family"]);
  const words = title
    .replace(/[—–\-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !SKIP.has(w.toLowerCase()))
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""));
  const catTerms: Record<string, string[]> = {
    wine_france: ["wine", "french"],
    wine_usa: ["wine", "california", "oregon"],
    wine_world: ["wine"],
    spirits: ["whiskey", "bourbon", "scotch", "gin", "rum", "vodka", "tequila"],
    beer: ["beer", "ipa", "ale", "lager", "stout"],
    cocktails: ["cocktail"],
    cocktail_recipes: ["cocktail"],
  };
  return [...new Set([...words, ...(catTerms[categoryGroup ?? ""] ?? [])])].slice(0, 6);
}

export default function ExploreScreen() {
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Map<string, Progress>>(new Map());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Module | null>(null);

  // Quiz state for detail
  const [content, setContent] = useState("");
  const [quizQs, setQuizQs] = useState<any[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [modRes, progRes] = await Promise.all([
      supabase.from("modules").select("id, title, description, category_group, star_reward, duration_minutes").eq("is_published", true).order("category_group").order("position"),
      supabase.from("progress").select("module_id, status, stars_earned").eq("user_id", user.id),
    ]);
    setModules((modRes.data as Module[]) ?? []);
    const map = new Map<string, Progress>();
    for (const p of (progRes.data as Progress[]) ?? []) map.set(p.module_id, p);
    setProgress(map);
    // Load store slug for shop links
    const { data: profile } = await supabase.from("users").select("store_id").eq("id", user.id).maybeSingle();
    if ((profile as any)?.store_id) {
      const { data: store } = await supabase.from("stores").select("slug").eq("id", (profile as any).store_id).maybeSingle();
      setStoreSlug((store as any)?.slug ?? null);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => ["all", ...Array.from(new Set(modules.map((m) => m.category_group).filter(Boolean)))], [modules]);

  const filtered = useMemo(() => {
    let list = modules;
    if (filter !== "all") list = list.filter((m) => m.category_group === filter);
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter((m) => m.title.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q)); }
    return list;
  }, [modules, filter, search]);

  async function openModule(m: Module) {
    setSelected(m);
    const [cRes, qRes] = await Promise.all([
      supabase.from("modules").select("content").eq("id", m.id).maybeSingle(),
      supabase.from("quiz_questions").select("id, question, options, correct_index, explanation").eq("module_id", m.id).order("position"),
    ]);
    const c = cRes.data as any;
    // content was migrated from JSON ({body}) to plain markdown TEXT — support both.
    const raw = c?.content;
    setContent(typeof raw === "string" ? raw : (raw?.body ?? ""));
    const qs = (qRes.data ?? []).map((q: any) => ({ ...q, options: Array.isArray(q.options) ? q.options : [] }));
    setQuizQs(qs);
    setAnswers(Array(qs.length).fill(null));
    setRevealed(Array(qs.length).fill(false));
    setResult(null);
  }

  function pick(qIdx: number, oIdx: number) {
    if (revealed[qIdx]) return;
    setAnswers((a) => { const n = [...a]; n[qIdx] = oIdx; return n; });
    setRevealed((r) => { const n = [...r]; n[qIdx] = true; return n; });
  }

  async function submit() {
    if (!selected || answers.some((a) => a === null)) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("submit_quiz_attempt", { p_module_id: selected.id, p_answers: answers });
    setSubmitting(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setResult(data);
  }

  // Detail view
  if (selected) {
    const img = getModuleImage(selected.title, selected.category_group);
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20 }}>
        <TouchableOpacity onPress={() => { setSelected(null); load(); }} style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.muted, fontSize: 14 }}>← Back</Text>
        </TouchableOpacity>
        <Image source={{ uri: img }} style={{ width: "100%", height: 200, borderRadius: 16, marginBottom: 16, backgroundColor: "#F3F4F6" }} resizeMode="cover" />
        <Text style={{ fontSize: 26, fontWeight: "700", marginBottom: 8 }}>{selected.title}</Text>
        {selected.description && <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 16 }}>{selected.description}</Text>}

        {/* Read or Listen toggle */}
        {content.length > 0 && (
          <ListenButton text={content} title={selected.title} />
        )}

        <Text style={{ fontSize: 14, lineHeight: 22, marginBottom: 24 }}>{content}</Text>

        {/* Dynamic products from the store's inventory */}
        <StoreProducts
          keywords={extractSearchTerms(selected.title, selected.category_group)}
          title="From your store"
        />

        {/* Shop link — connects to the store's Megan Shopper */}
        <ShopLink
          storeSlug={storeSlug}
          searchQuery={extractSearchTerms(selected.title, selected.category_group)[0] ?? selected.title}
        />

        {result ? (
          <>
          <QuizCelebration
            passed={result.passed}
            correct={result.correct}
            total={result.total}
            starsNew={result.stars_new ?? 0}
          />
          <TouchableOpacity style={{ backgroundColor: colors.gold, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, alignSelf: "center", marginBottom: 24 }}
            onPress={() => { setResult(null); setAnswers(Array(quizQs.length).fill(null)); setRevealed(Array(quizQs.length).fill(false)); }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Try again</Text>
          </TouchableOpacity>
          </>
        ) : quizQs.length > 0 ? (
          <>
            <Text style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: colors.muted, marginBottom: 16 }}>Quick check</Text>
            {quizQs.map((q: any, qIdx: number) => (
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
                {revealed[qIdx] && q.explanation && <View style={{ backgroundColor: "#F9FAFB", borderRadius: 8, padding: 12, marginTop: 4 }}><Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>{q.explanation}</Text></View>}
              </View>
            ))}
            <TouchableOpacity style={{ backgroundColor: colors.gold, borderRadius: 8, paddingVertical: 14, alignItems: "center", marginBottom: 32, opacity: answers.every((a) => a !== null) && !submitting ? 1 : 0.4 }}
              disabled={!answers.every((a) => a !== null) || submitting} onPress={submit}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{submitting ? "Submitting..." : "Submit quiz"}</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    );
  }

  // List view
  return (
    <View style={s.container}>
      <Text style={s.count}>{filtered.length} modules available</Text>
      <View style={s.searchWrap}>
        <TextInput style={s.searchInput} placeholder="Search modules..." placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {categories.map((cat) => {
          const active = cat === filter;
          return (
            <TouchableOpacity key={cat as string} onPress={() => setFilter(cat as string)} style={[s.chip, active && s.chipActive]}>
              <Text style={[s.chipText, active && s.chipTextActive]}>{cat === "all" ? "All" : CATEGORY_BADGES[cat as string]?.label ?? cat}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <FlatList data={filtered} keyExtractor={(m) => m.id} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />}
        renderItem={({ item: m }) => {
          const done = progress.get(m.id)?.status === "completed";
          const badge = CATEGORY_BADGES[m.category_group ?? "spirits"];
          const img = getModuleImage(m.title, m.category_group);
          return (
            <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => openModule(m)}>
              <Image source={{ uri: img }} style={s.thumb} resizeMode="cover" />
              <View style={{ flex: 1 }}>
                {badge && <View style={[s.catBadge, { backgroundColor: badge.bg }]}><Text style={[s.catText, { color: badge.color }]}>{badge.label}</Text></View>}
                <Text style={s.title} numberOfLines={1}>{m.title}</Text>
                {m.description && <Text style={s.desc} numberOfLines={1}>{m.description}</Text>}
              </View>
              {done && <View style={s.check}><Text style={s.checkText}>✓</Text></View>}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  count: { paddingHorizontal: 16, paddingTop: 8, fontSize: 13, color: colors.muted },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  searchInput: { backgroundColor: "#F3F4F6", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: colors.fg },
  chipScroll: { maxHeight: 48, marginBottom: 4 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.fg },
  chipTextActive: { color: "#fff" },
  row: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#F3F4F6" },
  catBadge: { borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1, alignSelf: "flex-start", marginBottom: 3 },
  catText: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  title: { fontSize: 15, fontWeight: "700" },
  desc: { fontSize: 12, color: colors.muted, marginTop: 1 },
  check: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#22c55e", alignItems: "center", justifyContent: "center" },
  checkText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
