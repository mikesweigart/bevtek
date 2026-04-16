import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { colors } from "../../lib/theme";

type Module = {
  id: string;
  title: string;
  description: string | null;
  category_group: string | null;
  star_reward: number;
};

type Progress = {
  module_id: string;
  status: string;
  stars_earned: number;
};

const CAT_LABELS: Record<string, string> = {
  wine_france: "Wine — France",
  wine_usa: "Wine — USA",
  wine_world: "Wine — World",
  spirits: "Spirits",
  beer: "Beer",
  cocktails: "Cocktails",
  custom: "Your Store",
};

export default function TrainerScreen() {
  const { user } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [progress, setProgress] = useState<Map<string, Progress>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Module | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [modRes, progRes] = await Promise.all([
      supabase
        .from("modules")
        .select("id, title, description, category_group, star_reward")
        .eq("is_published", true)
        .order("category_group")
        .order("position"),
      supabase
        .from("progress")
        .select("module_id, status, stars_earned")
        .eq("user_id", user.id),
    ]);
    setModules((modRes.data as Module[]) ?? []);
    const map = new Map<string, Progress>();
    for (const p of (progRes.data as Progress[]) ?? []) {
      map.set(p.module_id, p);
    }
    setProgress(map);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // Group by category
  const groups = new Map<string, Module[]>();
  for (const m of modules) {
    const k = m.category_group ?? "other";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(m);
  }
  const sections = Array.from(groups.entries()).map(([key, items]) => ({
    key,
    label: CAT_LABELS[key] ?? key,
    items,
  }));

  if (selected) {
    return (
      <ModuleDetail
        mod={selected}
        progress={progress.get(selected.id)}
        userId={user?.id ?? ""}
        onBack={() => {
          setSelected(null);
          load();
        }}
      />
    );
  }

  return (
    <FlatList
      style={s.list}
      contentContainerStyle={{ padding: 16 }}
      data={sections}
      keyExtractor={(sec) => sec.key}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.gold}
        />
      }
      renderItem={({ item: sec }) => (
        <View style={{ marginBottom: 24 }}>
          <Text style={s.catLabel}>{sec.label}</Text>
          {sec.items.map((m) => {
            const pr = progress.get(m.id);
            const stars = pr?.stars_earned ?? 0;
            return (
              <TouchableOpacity
                key={m.id}
                style={s.card}
                onPress={() => setSelected(m)}
                activeOpacity={0.7}
              >
                <View style={s.cardHeader}>
                  <Text style={s.cardTitle} numberOfLines={1}>
                    {m.title}
                  </Text>
                  {stars > 0 && (
                    <Text style={s.stars}>{"⭐".repeat(stars)}</Text>
                  )}
                </View>
                {m.description && (
                  <Text style={s.cardDesc} numberOfLines={2}>
                    {m.description}
                  </Text>
                )}
                <View style={s.cardFooter}>
                  <View
                    style={[
                      s.badge,
                      pr?.status === "completed"
                        ? s.badgeDone
                        : pr?.status === "in_progress"
                          ? s.badgeProgress
                          : s.badgeNew,
                    ]}
                  >
                    <Text
                      style={[
                        s.badgeText,
                        pr?.status === "completed" && { color: "#fff" },
                      ]}
                    >
                      {pr?.status === "completed"
                        ? "Done"
                        : pr?.status === "in_progress"
                          ? "In progress"
                          : "New"}
                    </Text>
                  </View>
                  <Text style={s.rewardText}>
                    {m.star_reward} ⭐ to earn
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    />
  );
}

// Inline module detail view (avoids needing separate route for now)
function ModuleDetail({
  mod,
  progress: pr,
  userId,
  onBack,
}: {
  mod: Module;
  progress: Progress | undefined;
  userId: string;
  onBack: () => void;
}) {
  const [content, setContent] = useState("");
  const [quizQs, setQuizQs] = useState<
    Array<{
      id: string;
      question: string;
      options: string[];
      correct_index: number;
      explanation: string | null;
    }>
  >([]);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [result, setResult] = useState<{
    correct: number;
    total: number;
    passed: boolean;
    starsNew: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [contentRes, quizRes] = await Promise.all([
        supabase
          .from("modules")
          .select("content")
          .eq("id", mod.id)
          .maybeSingle(),
        supabase
          .from("quiz_questions")
          .select("id, question, options, correct_index, explanation")
          .eq("module_id", mod.id)
          .order("position"),
      ]);
      const c = contentRes.data as { content: { body?: string } | null } | null;
      setContent(c?.content?.body ?? "");
      const qs = (quizRes.data ?? []).map((q: any) => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : [],
      }));
      setQuizQs(qs);
      setAnswers(Array(qs.length).fill(null));
      setRevealed(Array(qs.length).fill(false));
    })();
  }, [mod.id]);

  function pick(qIdx: number, oIdx: number) {
    if (revealed[qIdx]) return;
    setAnswers((a) => {
      const n = [...a];
      n[qIdx] = oIdx;
      return n;
    });
    setRevealed((r) => {
      const n = [...r];
      n[qIdx] = true;
      return n;
    });
  }

  async function submit() {
    if (answers.some((a) => a === null)) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("submit_quiz_attempt", {
      p_module_id: mod.id,
      p_answers: answers,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    const r = data as any;
    setResult({
      correct: r.correct,
      total: r.total,
      passed: r.passed,
      starsNew: r.stars_new,
    });
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 20 }}
      data={[1]} // single-item list to enable scroll
      keyExtractor={() => "module"}
      renderItem={() => (
        <View>
          <TouchableOpacity onPress={onBack} style={{ marginBottom: 16 }}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>
              ← Back to modules
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 26, fontWeight: "600", marginBottom: 8 }}>
            {mod.title}
          </Text>
          {mod.description && (
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 16 }}>
              {mod.description}
            </Text>
          )}

          <Text style={{ fontSize: 14, lineHeight: 22, marginBottom: 32 }}>
            {content}
          </Text>

          {result ? (
            <View
              style={{
                borderWidth: 2,
                borderColor: result.passed ? colors.gold : colors.border,
                borderRadius: 16,
                padding: 24,
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              {result.passed ? (
                <>
                  <Text style={{ fontSize: 40 }}>⭐</Text>
                  <Text
                    style={{ fontSize: 24, fontWeight: "600", marginTop: 8 }}
                  >
                    {result.correct}/{result.total} correct
                  </Text>
                  {result.starsNew > 0 && (
                    <Text style={{ fontSize: 16, marginTop: 4 }}>
                      +{result.starsNew} stars earned
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text
                    style={{ fontSize: 24, fontWeight: "600", marginTop: 8 }}
                  >
                    {result.correct}/{result.total} correct
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: colors.muted,
                      marginTop: 8,
                      textAlign: "center",
                    }}
                  >
                    Review the material and try again — perfect score earns
                    stars.
                  </Text>
                </>
              )}
              <TouchableOpacity
                style={{
                  backgroundColor: colors.gold,
                  borderRadius: 8,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  marginTop: 16,
                }}
                onPress={() => {
                  setResult(null);
                  setAnswers(Array(quizQs.length).fill(null));
                  setRevealed(Array(quizQs.length).fill(false));
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  Try again
                </Text>
              </TouchableOpacity>
            </View>
          ) : quizQs.length > 0 ? (
            <>
              <Text
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: colors.muted,
                  marginBottom: 16,
                }}
              >
                Quick check
              </Text>
              {quizQs.map((q, qIdx) => (
                <View
                  key={q.id}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{ fontSize: 14, fontWeight: "600", marginBottom: 12 }}
                  >
                    {q.question}
                  </Text>
                  {q.options.map((opt: string, oIdx: number) => {
                    const picked = answers[qIdx] === oIdx;
                    const show = revealed[qIdx];
                    const correct = oIdx === q.correct_index;
                    return (
                      <TouchableOpacity
                        key={oIdx}
                        disabled={show}
                        onPress={() => pick(qIdx, oIdx)}
                        style={{
                          borderWidth: 1,
                          borderColor: show
                            ? correct
                              ? "#16a34a"
                              : picked
                                ? "#dc2626"
                                : colors.border
                            : picked
                              ? colors.gold
                              : colors.border,
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 8,
                          backgroundColor: show && correct
                            ? "#f0fdf4"
                            : show && picked && !correct
                              ? "#fef2f2"
                              : picked
                                ? "#FBF7F0"
                                : "transparent",
                        }}
                      >
                        <Text style={{ fontSize: 14 }}>
                          {String.fromCharCode(65 + oIdx)}. {opt}
                          {show && correct ? " ✓" : ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {revealed[qIdx] && q.explanation && (
                    <View
                      style={{
                        backgroundColor: "#F9FAFB",
                        borderRadius: 8,
                        padding: 12,
                        marginTop: 4,
                      }}
                    >
                      <Text
                        style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}
                      >
                        {q.explanation}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
              <TouchableOpacity
                style={{
                  backgroundColor: colors.gold,
                  borderRadius: 8,
                  paddingVertical: 14,
                  alignItems: "center",
                  marginBottom: 32,
                  opacity:
                    answers.every((a) => a !== null) && !submitting ? 1 : 0.4,
                }}
                disabled={!answers.every((a) => a !== null) || submitting}
                onPress={submit}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
                  {submitting ? "Submitting..." : "Submit quiz"}
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  catLabel: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: 8,
    fontWeight: "600",
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: { fontSize: 15, fontWeight: "600", flex: 1, marginRight: 8 },
  stars: { fontSize: 12 },
  cardDesc: { fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: 8 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  badgeDone: { backgroundColor: colors.gold },
  badgeProgress: { backgroundColor: "#FEF3C7" },
  badgeNew: { backgroundColor: "#F3F4F6" },
  badgeText: { fontSize: 10, fontWeight: "600", color: colors.fg },
  rewardText: { fontSize: 10, color: colors.muted },
});
