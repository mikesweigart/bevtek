"use client";

import { useState } from "react";
import Link from "next/link";
import { submitQuizAttemptAction, type QuizResult } from "./quiz-actions";

type Question = {
  id: string;
  position: number;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

// Local (client-computed) grade, shown on the preview screen before the
// employee commits the attempt. Lets them retake without recording a low
// score. Server-authoritative grading (including stars-new, which depends
// on prior attempts) comes back from `submitQuizAttemptAction`.
type PreviewResult = {
  correct: number;
  total: number;
  passed: boolean;
};

export function QuizRunner({
  moduleId,
  moduleTitle,
  questions,
}: {
  moduleId: string;
  moduleTitle: string;
  questions: Question[];
}) {
  const [selected, setSelected] = useState<Array<number | null>>(
    Array(questions.length).fill(null),
  );
  const [revealed, setRevealed] = useState<boolean[]>(
    Array(questions.length).fill(false),
  );
  // Three phases: answering (both preview & result null) → preview set →
  // result set. `retake()` resets everything back to answering.
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  function handlePick(qIdx: number, optIdx: number) {
    if (revealed[qIdx]) return;
    setSelected((s) => {
      const next = [...s];
      next[qIdx] = optIdx;
      return next;
    });
    setRevealed((r) => {
      const next = [...r];
      next[qIdx] = true;
      return next;
    });
  }

  // Grade locally — no backend call yet. The employee sees their score on
  // the preview screen and chooses Submit or Retake.
  function finishAndPreview() {
    if (selected.some((s) => s === null)) return;
    const correct = questions.reduce(
      (n, q, i) => n + (selected[i] === q.correct_index ? 1 : 0),
      0,
    );
    const total = questions.length;
    setPreview({ correct, total, passed: correct === total });
  }

  // Commit the attempt. Server recomputes the score (don't trust the
  // client's) and returns stars-awarded info.
  async function submitToRecord() {
    if (!preview) return;
    setSubmitting(true);
    const res = await submitQuizAttemptAction(
      moduleId,
      selected.map((s) => s as number),
    );
    setResult(res);
    setSubmitting(false);
  }

  function retake() {
    setSelected(Array(questions.length).fill(null));
    setRevealed(Array(questions.length).fill(false));
    setPreview(null);
    setResult(null);
  }

  const allAnswered = selected.every((s) => s !== null);

  // --- FINAL RESULTS (server-recorded) ---
  if (result && !result.error) {
    return (
      <div className="space-y-6">
        <div
          className={`rounded-2xl p-8 text-center space-y-4 ${
            result.passed
              ? "bg-gradient-to-br from-[#FBF7F0] to-[#EED9B8] border-2 border-[color:var(--color-gold)]"
              : "border border-[color:var(--color-border)]"
          }`}
        >
          {result.passed ? (
            <>
              <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
                Perfect score — submitted
              </p>
              <p className="text-6xl">⭐</p>
              <h2 className="text-3xl font-semibold tracking-tight">
                {result.correct}/{result.total} correct
              </h2>
              {result.starsNew && result.starsNew > 0 ? (
                <p className="text-lg text-[color:var(--color-fg)]">
                  +{result.starsNew} stars earned
                </p>
              ) : (
                <p className="text-sm text-[color:var(--color-muted)]">
                  (already earned stars on this module before)
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
                Submitted
              </p>
              <h2 className="text-3xl font-semibold tracking-tight">
                {result.correct}/{result.total} correct
              </h2>
              <p className="text-sm text-[color:var(--color-muted)]">
                Review the material and retake — you need a perfect score to
                earn stars.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={retake}
            className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-semibold"
          >
            Retake quiz
          </button>
          <Link
            href="/trainer"
            className="rounded-md border border-[color:var(--color-border)] px-5 py-2.5 text-sm font-medium hover:border-[color:var(--color-fg)]"
          >
            Back to modules
          </Link>
        </div>
      </div>
    );
  }

  // --- PREVIEW (local grading, not yet saved) ---
  if (preview) {
    return (
      <div className="space-y-6">
        <div
          className={`rounded-2xl p-8 text-center space-y-4 ${
            preview.passed
              ? "bg-gradient-to-br from-[#FBF7F0] to-[#EED9B8] border-2 border-[color:var(--color-gold)]"
              : "border border-[color:var(--color-border)]"
          }`}
        >
          <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
            {preview.passed ? "Preview — perfect score" : "Preview"}
          </p>
          {preview.passed && <p className="text-6xl">⭐</p>}
          <h2 className="text-3xl font-semibold tracking-tight">
            {preview.correct}/{preview.total} correct
          </h2>
          <p className="text-sm text-[color:var(--color-muted)]">
            Nothing saved yet. Submit to record this attempt, or retake for a
            better score.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={submitToRecord}
            disabled={submitting}
            className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting…" : "Submit results"}
          </button>
          <button
            onClick={retake}
            disabled={submitting}
            className="rounded-md border border-[color:var(--color-border)] px-5 py-2.5 text-sm font-medium hover:border-[color:var(--color-fg)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Retake quiz
          </button>
        </div>
        {result?.error && (
          <p className="text-sm text-red-600">{result.error}</p>
        )}
      </div>
    );
  }

  // --- QUIZ-TAKING ---
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
          Quick check
        </p>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">
          {moduleTitle}
        </h1>
      </div>

      {questions.map((q, qIdx) => {
        const picked = selected[qIdx];
        const show = revealed[qIdx];
        return (
          <div
            key={q.id}
            className="space-y-3 rounded-lg border border-[color:var(--color-border)] p-5"
          >
            <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
              Question {qIdx + 1} of {questions.length}
            </p>
            <p className="text-base font-medium leading-relaxed">{q.question}</p>
            <div className="space-y-2">
              {q.options.map((opt, oIdx) => {
                const isPicked = picked === oIdx;
                const isCorrect = oIdx === q.correct_index;
                const showColor = show && (isPicked || isCorrect);
                const cls = showColor
                  ? isCorrect
                    ? "bg-green-50 border-green-600 text-green-900"
                    : isPicked
                      ? "bg-red-50 border-red-600 text-red-900"
                      : "border-[color:var(--color-border)]"
                  : isPicked
                    ? "border-[color:var(--color-gold)] bg-[#FBF7F0]"
                    : "border-[color:var(--color-border)] hover:border-[color:var(--color-fg)]";
                return (
                  <button
                    key={oIdx}
                    onClick={() => handlePick(qIdx, oIdx)}
                    disabled={show}
                    className={`w-full text-left rounded-md border p-3 text-sm transition-colors ${cls} ${
                      show && !isCorrect && !isPicked ? "opacity-60" : ""
                    }`}
                  >
                    <span className="inline-block w-6 text-[color:var(--color-muted)] mr-2">
                      {String.fromCharCode(65 + oIdx)}.
                    </span>
                    {opt}
                    {show && isCorrect && " ✓"}
                  </button>
                );
              })}
            </div>
            {show && q.explanation && (
              <div className="rounded-md bg-zinc-50 p-3 text-sm text-[color:var(--color-muted)] leading-relaxed">
                {q.explanation}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <button
          onClick={finishAndPreview}
          disabled={!allAnswered}
          className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          See my score
        </button>
      </div>
    </div>
  );
}
