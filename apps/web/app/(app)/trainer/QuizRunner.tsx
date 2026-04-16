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

  async function submit() {
    if (selected.some((s) => s === null)) return;
    setSubmitting(true);
    const res = await submitQuizAttemptAction(
      moduleId,
      selected.map((s) => s as number),
    );
    setResult(res);
    setSubmitting(false);
  }

  function retry() {
    setSelected(Array(questions.length).fill(null));
    setRevealed(Array(questions.length).fill(false));
    setResult(null);
  }

  const allAnswered = selected.every((s) => s !== null);

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
                Perfect score
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
                Almost there
              </p>
              <h2 className="text-3xl font-semibold tracking-tight">
                {result.correct}/{result.total} correct
              </h2>
              <p className="text-sm text-[color:var(--color-muted)]">
                Review the material and try again — you need a perfect score to
                earn stars.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={retry}
            className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-semibold"
          >
            Try again
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
          onClick={submit}
          disabled={!allAnswered || submitting}
          className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Submitting…" : "Submit quiz"}
        </button>
        {result?.error && (
          <p className="text-sm text-red-600">{result.error}</p>
        )}
      </div>
    </div>
  );

}
