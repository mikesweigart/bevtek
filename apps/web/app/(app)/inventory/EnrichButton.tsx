"use client";

import { useActionState } from "react";
import {
  enrichImagesFromWikipediaAction,
  type EnrichState,
} from "./actions";

const initial: EnrichState = { error: null, scanned: null, updated: null };

export function EnrichButton() {
  const [state, action, pending] = useActionState(
    enrichImagesFromWikipediaAction,
    initial,
  );

  return (
    <form action={action} className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm hover:border-[color:var(--color-fg)] disabled:opacity-60"
      >
        {pending ? "Finding images…" : "Find images from Wikipedia"}
      </button>
      {state.scanned !== null && !state.error && (
        <span className="text-xs text-[color:var(--color-muted)]">
          Scanned {state.scanned}, updated {state.updated}. Run again to continue.
        </span>
      )}
      {state.error && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}
