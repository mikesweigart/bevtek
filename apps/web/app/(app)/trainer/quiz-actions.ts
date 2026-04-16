"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type QuizResult = {
  error: string | null;
  score: number | null;
  correct: number | null;
  total: number | null;
  passed: boolean | null;
  starsAwarded: number | null;
  starsNew: number | null;
};

export async function submitQuizAttemptAction(
  moduleId: string,
  answers: number[],
): Promise<QuizResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quiz_attempt", {
    p_module_id: moduleId,
    p_answers: answers,
  });

  if (error) {
    return {
      error: error.message,
      score: null,
      correct: null,
      total: null,
      passed: null,
      starsAwarded: null,
      starsNew: null,
    };
  }

  const r = data as {
    score: number;
    correct: number;
    total: number;
    passed: boolean;
    stars_awarded: number;
    stars_new: number;
  };

  revalidatePath(`/trainer/${moduleId}`);
  revalidatePath("/trainer");

  return {
    error: null,
    score: r.score,
    correct: r.correct,
    total: r.total,
    passed: r.passed,
    starsAwarded: r.stars_awarded,
    starsNew: r.stars_new,
  };
}
