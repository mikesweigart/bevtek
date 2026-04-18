"use client";

// "Prepare products for Gabby" — the owner-facing full-enrichment button.
//
// Two modes:
//   • Single batch    — one serverless call, up to 10 rows. Cheapest.
//   • Enrich everything — loops the server action back-to-back on the
//     client until `remaining` hits 0 (or the owner cancels). The
//     serverless timeout is sidestepped by doing many tiny calls
//     instead of one long one, and the owner sees running totals live.
//
// Cumulative tallies are kept in client state, not server state, so
// refreshing the page resets the counter (the DB is the source of truth;
// click again and it picks up exactly where enrichment stopped).

import { useCallback, useRef, useState } from "react";
import { enrichFullAction, type FullEnrichState } from "./actions";

const INITIAL_TOTALS = {
  processed: 0,
  verified: 0,
  high: 0,
  medium: 0,
  low: 0,
  partial: 0,
  none: 0,
};

export function EnrichFullButton() {
  const [running, setRunning] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [totals, setTotals] = useState(INITIAL_TOTALS);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  // One round-trip. Returns the server's reported state so the loop
  // can decide whether to fire again.
  const runOnce = useCallback(async (): Promise<FullEnrichState> => {
    // The server action expects `prevState` — we pass a fresh shape
    // because we track cumulative totals on the client instead.
    return enrichFullAction({
      error: null,
      processed: null,
      byConfidence: null,
      remaining: null,
    });
  }, []);

  const runSingleBatch = useCallback(async () => {
    setRunning(true);
    setError(null);
    setAutoMode(false);
    try {
      const s = await runOnce();
      if (s.error) {
        setError(s.error);
      } else if (s.byConfidence) {
        setTotals((t) => ({
          processed: t.processed + (s.processed ?? 0),
          verified: t.verified + s.byConfidence!.verified,
          high: t.high + s.byConfidence!.high,
          medium: t.medium + s.byConfidence!.medium,
          low: t.low + s.byConfidence!.low,
          partial: t.partial + s.byConfidence!.partial,
          none: t.none + s.byConfidence!.none,
        }));
        setRemaining(s.remaining);
      }
    } finally {
      setRunning(false);
    }
  }, [runOnce]);

  const runAuto = useCallback(async () => {
    setRunning(true);
    setAutoMode(true);
    setError(null);
    cancelRef.current = false;

    // Loop until nothing left, the user cancels, or an error happens.
    // A tiny delay between batches keeps the UI responsive and is kind
    // to Open Food Facts' rate limits.
    while (!cancelRef.current) {
      const s = await runOnce();
      if (s.error) {
        setError(s.error);
        break;
      }
      if (s.byConfidence) {
        setTotals((t) => ({
          processed: t.processed + (s.processed ?? 0),
          verified: t.verified + s.byConfidence!.verified,
          high: t.high + s.byConfidence!.high,
          medium: t.medium + s.byConfidence!.medium,
          low: t.low + s.byConfidence!.low,
          partial: t.partial + s.byConfidence!.partial,
          none: t.none + s.byConfidence!.none,
        }));
        setRemaining(s.remaining);
      }
      if ((s.processed ?? 0) === 0 || (s.remaining ?? 0) === 0) break;
      await sleep(400);
    }

    setRunning(false);
    setAutoMode(false);
  }, [runOnce]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const reset = useCallback(() => {
    setTotals(INITIAL_TOTALS);
    setRemaining(null);
    setError(null);
  }, []);

  const gabbyReady = totals.verified + totals.high + totals.medium + totals.low;
  const notReady = totals.partial + totals.none;
  const anyRun = totals.processed > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runAuto}
          disabled={running}
          className="rounded-md bg-[#C8984E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B8863C] disabled:opacity-60"
        >
          {running && autoMode
            ? `Enriching… (${totals.processed} done${
                remaining != null ? `, ${remaining} left` : ""
              })`
            : "✨ Prepare everything for Gabby"}
        </button>

        <button
          type="button"
          onClick={runSingleBatch}
          disabled={running}
          className="rounded-md border border-[color:var(--color-border)] px-3 py-2 text-xs hover:border-[color:var(--color-fg)] disabled:opacity-60"
        >
          {running && !autoMode ? "Working…" : "Just one batch (10)"}
        </button>

        {running && autoMode && (
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
            {gabbyReady}
          </strong>{" "}
          ready for Gabby
          {notReady > 0 && (
            <>
              {" · "}
              <strong className="text-[color:var(--color-fg)]">
                {notReady}
              </strong>{" "}
              need a photo or notes
            </>
          )}
          {remaining != null && (
            <>
              {" · "}
              <strong className="text-[color:var(--color-fg)]">
                {remaining}
              </strong>{" "}
              remaining in queue
            </>
          )}
          {remaining === 0 && !running && (
            <span className="ml-2 text-green-700">
              ✓ Your catalog is fully enriched.
            </span>
          )}
        </div>
      )}

      {error && <span className="text-xs text-red-600">{error}</span>}

      {!anyRun && !running && (
        <p className="text-xs text-[color:var(--color-muted)]">
          Fetches a photo and writes tasting notes for every product Gabby
          doesn&rsquo;t know yet. Feel free to leave this tab open — large
          catalogs can take a few minutes.
        </p>
      )}
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
