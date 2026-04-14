import { createClient } from "@/utils/supabase/server";
import { AssistantChat } from "./AssistantChat";

type Query = {
  id: string;
  query_text: string;
  response: string | null;
  created_at: string;
};

export default async function AssistantPage() {
  const supabase = await createClient();

  const { data: recent } = (await supabase
    .from("floor_queries")
    .select("id, query_text, response, created_at")
    .order("created_at", { ascending: false })
    .limit(10)) as { data: Query[] | null };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assistant</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Ask about a product, brand, or category — Megan searches live
          inventory.
        </p>
      </div>

      <AssistantChat />

      {(recent ?? []).length > 0 && (
        <section>
          <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)] mb-3">
            Recent questions
          </h2>
          <ul className="space-y-2">
            {(recent ?? []).map((q) => (
              <li
                key={q.id}
                className="rounded-md border border-[color:var(--color-border)] p-3 text-sm"
              >
                <div className="font-medium">{q.query_text}</div>
                {q.response && (
                  <div className="text-xs text-[color:var(--color-muted)] mt-0.5">
                    {q.response}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
