"use client";

// Classify Categories — sort every inventory row into one of the 12
// canonical buckets (Beer & Cider, RTDs & Hard Seltzers, Whiskey, Vodka,
// Rum, Tequila, Gin, Liqueurs, Wine, Non-Alcoholic, Cigars, General
// Non-Food) via the deterministic keyword classifier in
// lib/inventory/categoryGroup.ts.
//
// No AI calls, so this is cheap + fast — a catalog of a few thousand
// items finishes in one or two batches. Auto-loops until the remaining
// count hits zero. Click AFTER Step 1 (Parse product names) so the
// classifier has a clean `varietal` signal to work with.

import { useCallback, useRef, useState } from "react";
import {
  classifyCategoriesAction,
  type ClassifyCategoriesState,
} from "./actions";

export function ClassifyCategoriesButton() {
  const [running, setRunning] = useState(false);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [byGroup, setByGroup] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const runOnce = useCallback(async (): Promise<ClassifyCategoriesState> => {
    return classifyCategoriesAction({
      error: null,
      processed: null,
      remaining: null,
      byGroup: null,
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
      setRemaining(s.remaining);
      if (s.byGroup) {
        setByGroup((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(s.byGroup ?? {})) {
            next[k] = (next[k] ?? 0) + v;
          }
          return next;
        });
      }

      if ((s.processed ?? 0) === 0 || (s.remaining ?? 0) === 0) break;
      await sleep(200);
    }

    setRunning(false);
  }, [runOnce]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const reset = useCallback(() => {
    setTotalProcessed(0);
    setRemaining(null);
    setByGroup({});
    setError(null);
  }, []);

  const anyRun = totalProcessed > 0;
  const groupList = Object.entries(byGroup).sort((a, b) => b[1] - a[1]);

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
            ? `Sorting into 12 categories… (${totalProcessed} done${
                remaining != null ? `, ${remaining} left` : ""
              })`
            : "Step 1.5 · Organize into 12 categories"}
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
        <div className="text-xs text-[color:var(--color-muted)] space-y-1">
          <div>
            <strong className="text-[color:var(--color-fg)]">
              {totalProcessed}
            </strong>{" "}
            rows sorted
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
                ✓ Catalog fully categorized.
              </span>
            )}
          </div>
          {groupList.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {groupList.map(([g, n]) => (
                <span
                  key={g}
                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px]"
                >
                  {g}: <strong>{n}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <span className="text-xs text-red-600">{error}</span>}

      {!anyRun && !running && (
        <p className="text-xs text-[color:var(--color-muted)]">
          Sorts every product into one of 12 canonical buckets (Beer &
          Cider, Whiskey, RTDs &amp; Hard Seltzers, etc.) so you can
          filter the catalog by group and target promotions by category.
          Runs locally — no AI calls, no rate limits. Click after Step 1.
        </p>
      )}
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
