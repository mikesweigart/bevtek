import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { QuizRunner } from "../../QuizRunner";

type ModuleRow = { id: string; title: string };
type QuestionRow = {
  id: string;
  position: number;
  question: string;
  options: unknown;
  correct_index: number;
  explanation: string | null;
};

export default async function ModuleQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: modData } = (await supabase
    .from("modules")
    .select("id, title")
    .eq("id", id)
    .maybeSingle()) as { data: ModuleRow | null };
  if (!modData) notFound();

  const { data: qs } = (await supabase
    .from("quiz_questions")
    .select("id, position, question, options, correct_index, explanation")
    .eq("module_id", id)
    .order("position", { ascending: true })) as {
    data: QuestionRow[] | null;
  };

  if (!qs || qs.length === 0) {
    return (
      <div className="max-w-xl space-y-4">
        <Link
          href={`/trainer/${id}`}
          className="text-sm text-[color:var(--color-muted)]"
        >
          ← Back to module
        </Link>
        <h1 className="text-2xl font-semibold">No quiz yet</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          This module doesn&apos;t have quiz questions attached.
        </p>
      </div>
    );
  }

  const questions = qs.map((q) => ({
    ...q,
    options: Array.isArray(q.options) ? (q.options as string[]) : [],
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href={`/trainer/${id}`}
        className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
      >
        ← Back to module
      </Link>
      <QuizRunner
        moduleId={modData.id}
        moduleTitle={modData.title}
        questions={questions}
      />
    </div>
  );
}
