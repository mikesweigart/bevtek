import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { colors } from "../lib/theme";

type Props = {
  passed: boolean;
  correct: number;
  total: number;
  starsNew: number;
  streakDays?: number;
};

/**
 * Animated result card shown after quiz submission.
 * Scales in with a bounce for perfect scores.
 */
export function QuizCelebration({
  passed,
  correct,
  total,
  starsNew,
  streakDays,
}: Props) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: passed ? 4 : 6,
        tension: passed ? 100 : 60,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        s.container,
        passed && s.containerPassed,
        { transform: [{ scale }], opacity },
      ]}
    >
      {passed ? (
        <>
          <Text style={s.emoji}>🎉</Text>
          <Text style={s.title}>Perfect!</Text>
          <Text style={s.score}>
            {correct}/{total} correct
          </Text>
          {starsNew > 0 ? (
            <View style={s.starsRow}>
              <Text style={s.starsText}>+{starsNew}</Text>
              <Text style={s.starsEmoji}>⭐</Text>
            </View>
          ) : (
            <Text style={s.alreadyEarned}>
              Stars already earned on this module
            </Text>
          )}
          {streakDays && streakDays > 1 && (
            <View style={s.streakBadge}>
              <Text style={s.streakText}>
                🔥 {streakDays} day streak!
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={s.emoji}>📝</Text>
          <Text style={s.title}>Almost there!</Text>
          <Text style={s.score}>
            {correct}/{total} correct
          </Text>
          <Text style={s.retryHint}>
            Review the module and try again — perfect score earns stars.
          </Text>
        </>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: colors.bg,
  },
  containerPassed: {
    borderColor: colors.gold,
    backgroundColor: "#FBF7F0",
  },
  emoji: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, marginBottom: 4 },
  score: { fontSize: 18, fontWeight: "600", color: colors.muted, marginBottom: 12 },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.gold,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  starsText: { color: "#fff", fontWeight: "800", fontSize: 20 },
  starsEmoji: { fontSize: 20 },
  alreadyEarned: { fontSize: 12, color: colors.muted, fontStyle: "italic" },
  streakBadge: {
    marginTop: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  streakText: { fontSize: 13, fontWeight: "700", color: "#92400E" },
  retryHint: {
    fontSize: 13,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 260,
  },
});
