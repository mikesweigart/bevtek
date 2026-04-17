import { createClient } from "@/utils/supabase/server";
import Link from "next/link";

// Owner-facing feed of real Gabby chats. Groups by session_id so you see
// each customer's thread, not isolated one-liners. Also surfaces the top
// questions being asked — invaluable signal for what to train staff on.

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  session_id: string;
  user_message: string;
  assistant_message: string;
  inventory_count: number;
  created_at: string;
};

export default async function ConversationsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return (
      <div className="p-8">Please sign in to view conversations.</div>
    );
  }

  const { data: profile } = await supabase
    .from("users")
    .select("store_id, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const p = profile as { store_id?: string; role?: string } | null;
  if (!p?.store_id) {
    return <div className="p-8">No store on your profile yet.</div>;
  }

  const { data } = await supabase
    .from("gabby_conversations")
    .select("id, session_id, user_message, assistant_message, inventory_count, created_at")
    .eq("store_id", p.store_id)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as Row[];

  // Group by session.
  const sessions = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = sessions.get(r.session_id) ?? [];
    arr.push(r);
    sessions.set(r.session_id, arr);
  }
  const sessionList = Array.from(sessions.entries())
    .map(([sid, turns]) => ({
      sid,
      turns: turns.sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
      latest: turns[0].created_at,
    }))
    .sort((a, b) => (a.latest < b.latest ? 1 : -1));

  // Top-asked topics (naive: first 6 words of each user message, most common).
  const snippetCounts = new Map<string, number>();
  for (const r of rows) {
    const key = r.user_message
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .slice(0, 6)
      .join(" ")
      .trim();
    if (key.length < 8) continue;
    snippetCounts.set(key, (snippetCounts.get(key) ?? 0) + 1);
  }
  const topAsked = Array.from(snippetCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Gabby Conversations
        </h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-1">
          Every customer chat with Gabby, in your store&rsquo;s voice.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--color-border)] p-10 text-center">
          <p className="text-sm text-[color:var(--color-muted)]">
            No conversations yet. Once customers start chatting with Gabby,
            you&rsquo;ll see them here in real time.
          </p>
          <Link
            href="/assistant"
            className="inline-block mt-3 text-sm text-[color:var(--color-gold)] font-medium"
          >
            Try asking Gabby yourself &rarr;
          </Link>
        </div>
      ) : (
        <>
          {/* Stat strip */}
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Total chats" value={rows.length} />
            <Stat label="Unique sessions" value={sessionList.length} />
            <Stat
              label="Avg inventory shown"
              value={Math.round(
                rows.reduce((a, r) => a + r.inventory_count, 0) / rows.length,
              )}
            />
          </div>

          {/* Top-asked */}
          {topAsked.length > 0 && (
            <div className="rounded-xl border border-[color:var(--color-border)] bg-white p-5">
              <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)] mb-3">
                Most-asked topics
              </p>
              <ul className="space-y-2">
                {topAsked.map(([q, n]) => (
                  <li
                    key={q}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="truncate">&ldquo;{q}&hellip;&rdquo;</span>
                    <span className="text-xs text-[color:var(--color-muted)]">
                      {n} {n === 1 ? "time" : "times"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Thread list */}
          <div className="space-y-4">
            {sessionList.map(({ sid, turns }) => (
              <div
                key={sid}
                className="rounded-xl border border-[color:var(--color-border)] bg-white p-5 space-y-3"
              >
                <div className="flex items-center justify-between text-xs text-[color:var(--color-muted)]">
                  <span>Session {sid.slice(0, 8)}</span>
                  <span>
                    {new Date(turns[turns.length - 1].created_at).toLocaleString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      },
                    )}
                  </span>
                </div>
                {turns.map((t) => (
                  <div key={t.id} className="space-y-2">
                    <div className="flex gap-2 items-start">
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-600 px-2 py-1 rounded">
                        Customer
                      </span>
                      <p className="text-sm leading-relaxed">
                        {t.user_message}
                      </p>
                    </div>
                    <div className="flex gap-2 items-start">
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider bg-[color:var(--color-gold)] text-white px-2 py-1 rounded">
                        Gabby
                      </span>
                      <p className="text-sm leading-relaxed text-[color:var(--color-fg)]">
                        {t.assistant_message}
                      </p>
                    </div>
                    {t.inventory_count > 0 && (
                      <p className="text-[10px] text-[color:var(--color-muted)] pl-14">
                        Grounded in {t.inventory_count} of your SKUs
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-white p-4">
      <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
        {label}
      </p>
      <p className="text-3xl font-semibold mt-1">{value}</p>
    </div>
  );
}
