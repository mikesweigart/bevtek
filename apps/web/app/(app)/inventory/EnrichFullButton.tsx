"use client";

// "Prepare products for Gabby" — the owner-facing full-enrichment button.
//
// Calls enrichFullAction, which runs the image + tasting-notes + confidence
// pipeline for up to 20 unenriched rows per click. Shows what happened and
// how many rows still need attention so the owner knows whether to click
// again.

import { useActionState } from "react";
import { enrichFullAction, type FullEnrichState } from "./actions";

const initial: FullEnrichState = {
  error: null,
  processed: null,
  byConfidence: null,
  remaining: null,
};

export function EnrichFullButton() {
  const [state, action, pending] = useActionState(enrichFullAction, initial);

  const hasResult = state.processed !== null && !state.error;
  const tally = state.byConfidence;
  const gabbyReady =
    tally != null ? tally.verified + tally.high + tally.medium + tally.low : 0;
  const notReady = tally != null ? tally.partial + tally.none : 0;

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[#C8984E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B8863C] disabled:opacity-60"
      >
        {pending
          ? "Enriching (up to a minute)…"
          : "✨ Prepare products for Gabby"}
      </button>

      {hasResult && state.processed === 0 && (
        <span className="text-xs text-[color:var(--color-muted)]">
          Nothing left to enrich — your catalog is ready.
        </span>
      )}

      {hasResult && state.processed! > 0 && tally && (
        <span className="text-xs text-[color:var(--color-muted)]">
          Processed {state.processed}: {gabbyReady} ready for Gabby
          {notReady > 0 && `, ${notReady} need a photo or notes`}.
          {state.remaining != null && state.remaining > 0 && (
            <>
              {" "}
              <strong>{state.remaining} remaining</strong> — click again to
              continue.
            </>
          )}
        </span>
      )}

      {state.error && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}
