import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type Store = { id: string; name: string; slug: string };

export default async function ShopperLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: store } = (await supabase
    .from("public_stores")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle()) as { data: Store | null };

  if (!store) notFound();

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-[color:var(--color-border)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href={`/s/${store.slug}`}
            className="text-base sm:text-lg font-semibold tracking-tight"
          >
            {store.name}
          </Link>
          <span className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
            BevTek
          </span>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
        {children}
      </main>
      <footer className="border-t border-[color:var(--color-border)] py-6">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 text-xs text-[color:var(--color-muted)]">
          Powered by{" "}
          <span className="text-[color:var(--color-gold)]">Megan</span>
        </div>
      </footer>
    </div>
  );
}
