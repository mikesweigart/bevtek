import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-xl w-full text-center space-y-6">
        <p className="text-sm tracking-widest uppercase text-[color:var(--color-muted)]">
          BevTek
        </p>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          Meet <span className="text-[color:var(--color-gold)]">Megan</span>.
        </h1>
        <p className="text-[color:var(--color-muted)]">
          The AI platform for beverage retail. Trainer, Assistant, Receptionist,
          Shopper, and Texting — all under one roof.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm font-medium text-white bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] transition-colors"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm font-medium border border-[color:var(--color-border)] hover:border-[color:var(--color-fg)] transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
