"use client";

// Normalize Names — parse raw ALL-CAPS CSV names into brand / varietal / size.
//
// This is Pass 0 of the enrichment chain: without structured brand +
// varietal, every downstream image / notes / review provider whiffs.
// The button runs back-to-back batches of 60 rows each (Haiku is fast
// enough that one batch is ~5s), and auto-stops when the catalog is
// fully parsed. The owner should click this BEFORE "Prepare everything
// for Gabby" the first time they upload a catalog.

import { useCallback, useRef, useState } from "react";
import { normalizeNamesAction, type NormalizeState } from "./actions";

export function NormalizeNamesButton() {
  const [running, setRunning] = useState(false);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [totalParsed, setTotalParsed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const runOnce = useCallback(async (): Promise<NormalizeState> => {
    return normalizeNamesAction({
      error: null,
      processed: null,
      remaining: null,
      parsed: null,
    });
  }, []);

  const runAuto = useCallback(async () => {
    setRunning(true);
    setError(null);
    cancelRef.current = false;

    while (!cancelRef.current) {
      const s = await runOnce();
      if (s.error) {
        setError(s.error);
        break;
      }
      setTotalProcessed((n) => n + (s.processed ?? 0));
      setTotalParsed((n) => n + (s.parsed ?? 0));
      setRemaining(s.remaining);

      if ((s.processed ?? 0) === 0 || (s.remaining ?? 0) === 0) break;

      // Safety net: if we processed rows but wrote ZERO brands, we're
      // stuck in a silent-failure loop (usually means Haiku returned
      // non-parseable output or ANTHROPIC_API_KEY is unset). Stop after
      // two consecutive dry batches and surface the problem.
      if ((s.processed ?? 0) > 0 && (s.parsed ?? 0) === 0) {
        setError(
          "Haiku processed rows but wrote 0 brands. Visit /api/debug/normalize to see the raw Claude response. Usually means ANTHROPIC_API_KEY is missing or the JSON response isn't parsing.",
        );
        break;
      }

      // Brief UI-responsiveness pause — Haiku is cheap, no external
      // rate-limit concern here.
      await sleep(400);
    }

    setRunning(false);
  }, [runOnce]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const reset = useCallback(() => {
    setTotalProcessed(0);
    setTotalParsed(0);
    setRemaining(null);
    setError(null);
  }, []);

  const anyRun = totalProcessed > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runAuto}
          disabled={running}
          className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg-soft,#f7f3eb)] px-3 py-2 text-xs font-medium hover:border-[color:var(--color-fg)] disabled:opacity-60"
        >
          {running
            ? `Parsing names… (${totalProcessed} done${
                remaining != null ? `, ${remaining} left` : ""
              })`
            : "Step 1 · Parse product names"}
        </button>

        {running && (
          <button
            type="button"
            onClick={cancel}
            className="text-xs text-red-600 underline"
          >
            Stop
          </button>
        )}

        {!running && anyRun && (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-[color:var(--color-muted)] underline"
          >
            Clear counter
          </button>
        )}
      </div>

      {anyRun && !error && (
        <div className="text-xs text-[color:var(--color-muted)]">
          <strong className="text-[color:var(--color-fg)]">
            {totalParsed}
          </strong>{" "}
          products tagged with a brand
          {remaining != null && (
            <>
              {" · "}
              <strong className="text-[color:var(--color-fg)]">
                {remaining}
              </strong>{" "}
              remaining
            </>
          )}
          {remaining === 0 && !running && (
            <span className="ml-2 text-green-700">
              ✓ All names parsed — now click &ldquo;Prepare everything for
              Gabby&rdquo;.
            </span>
          )}
        </div>
      )}

      {error && <span className="text-xs text-red-600">{error}</span>}

      {!anyRun && !running && (
        <p className="text-xs text-[color:var(--color-muted)]">
          Reads each raw product name (&ldquo;SUTTER HOME PINOT GRIGIO 1.5
          L&rdquo;) and splits it into brand, varietal, and size so Gabby
          can find photos and reviews. Run this once after every catalog
          upload.
        </p>
      )}
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
