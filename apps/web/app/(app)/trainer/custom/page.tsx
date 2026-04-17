import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PdfUploader } from "./PdfUploader";

export default async function CustomModulePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("role, store_id")
    .eq("id", auth.user!.id)
    .maybeSingle();
  const p = profile as { role?: string; store_id?: string } | null;
  if (p?.role !== "owner" && p?.role !== "manager") redirect("/trainer");

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/trainer"
        className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
      >
        ← Back to Trainer
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create a custom module
        </h1>
        <p className="text-sm text-[color:var(--color-muted)] mt-1">
          Upload a product sheet, brand guide, or training document. Megan reads
          it and generates a complete training module with quiz questions
          automatically.
        </p>
      </div>

      <PdfUploader storeId={p!.store_id!} />

      <div className="rounded-lg border border-[color:var(--color-border)] p-5 space-y-3">
        <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
          What works best
        </h2>
        <ul className="space-y-2 text-sm text-[color:var(--color-muted)]">
          <li className="flex gap-2">
            <span className="text-[color:var(--color-gold)] font-semibold">✓</span>
            <span>New product one-sheets from your distributor</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[color:var(--color-gold)] font-semibold">✓</span>
            <span>Brand training guides (e.g., "Understanding Bourbon" from Maker's Mark)</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[color:var(--color-gold)] font-semibold">✓</span>
            <span>Seasonal featured product descriptions</span>
          </li>
          <li className="flex gap-2">
            <span className="text-[color:var(--color-gold)] font-semibold">✓</span>
            <span>Store-specific policies or procedures</span>
          </li>
        </ul>
        <p className="text-xs text-[color:var(--color-muted)]">
          PDF, DOCX, or plain text. Max 10 MB. Megan extracts the key facts,
          writes a concise module, and generates 2 quiz questions.
        </p>
      </div>

      <div className="rounded-lg border border-[color:var(--color-border)] p-5 space-y-3">
        <h2 className="text-sm font-semibold tracking-widest uppercase text-[color:var(--color-muted)]">
          Or write it yourself
        </h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Prefer to write the module content manually? Use the regular module
          creator — full control over every word.
        </p>
        <Link
          href="/trainer/new"
          className="inline-flex items-center justify-center rounded-md border border-[color:var(--color-border)] hover:border-[color:var(--color-fg)] px-4 py-2 text-sm font-medium"
        >
          Write a module manually
        </Link>
      </div>
    </div>
  );
}
