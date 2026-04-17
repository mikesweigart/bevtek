"use client";

import { useState } from "react";

type BackfillResult = {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
  results: Array<{ title: string; status: string; url?: string; error?: string }>;
};

export function BackfillImagesButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(force = false) {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/backfill-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Backfill failed.");
      } else {
        setResult(json);
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setRunning(false);
  }

  return (
    <div className="rounded-lg border border-[color:var(--color-border)] p-5 mb-6">
      <h3 className="text-sm font-semibold mb-1">Module Hero Images (Unsplash)</h3>
      <p className="text-xs text-[color:var(--color-muted)] mb-3 leading-relaxed">
        Fetches subject-accurate photos for all 100 modules using the Unsplash API.
        Each query is tuned per module (e.g. &quot;bourbon bottle kentucky&quot;, &quot;manhattan cocktail coupe cherry amber&quot;).
        Free tier caps at 50 requests/hour — if you hit the limit, wait an hour and click again.
        Only fills missing images unless you click &quot;Force refresh&quot;.
      </p>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => run(false)}
          disabled={running}
          className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {running ? "Fetching photos..." : "Backfill missing images"}
        </button>
        <button
          onClick={() => run(true)}
          disabled={running}
          className="rounded-md border border-[color:var(--color-border)] hover:border-[color:var(--color-fg)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Force refresh all
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {result && (
        <div className="text-xs space-y-1">
          <p>
            <strong>{result.updated}</strong> updated ·{" "}
            <strong>{result.skipped}</strong> skipped ·{" "}
            <strong>{result.failed}</strong> failed · {result.total} total
          </p>
          {result.failed > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-red-600">
                Show failures ({result.failed})
              </summary>
              <ul className="mt-2 space-y-1 pl-4">
                {result.results
                  .filter((r) => r.status !== "updated" && r.status !== "skipped (already set)")
                  .map((r, i) => (
                    <li key={i} className="text-[color:var(--color-muted)]">
                      <strong>{r.title}</strong> — {r.status}
                      {r.error && ` (${r.error})`}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
