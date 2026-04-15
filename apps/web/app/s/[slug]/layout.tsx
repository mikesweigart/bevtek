import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";

type Store = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_stores")
    .select("name, logo_url")
    .eq("slug", slug)
    .maybeSingle();
  const store = data as { name: string; logo_url: string | null } | null;
  if (!store) return { title: "Store not found" };
  return {
    title: store.name,
    description: `Shop ${store.name} online.`,
    openGraph: {
      title: store.name,
      description: `Shop ${store.name} online.`,
      images: store.logo_url ? [{ url: store.logo_url }] : undefined,
    },
  };
}

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
    .select("id, name, slug, logo_url")
    .eq("slug", slug)
    .maybeSingle()) as { data: Store | null };

  if (!store) notFound();

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-[color:var(--color-border)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href={`/s/${store.slug}`}
            className="flex items-center gap-3"
          >
            {store.logo_url ? (
              <div className="relative w-10 h-10 rounded overflow-hidden bg-zinc-50">
                <Image
                  src={store.logo_url}
                  alt={`${store.name} logo`}
                  fill
                  sizes="40px"
                  className="object-contain"
                  unoptimized
                />
              </div>
            ) : null}
            <span className="text-base sm:text-lg font-semibold tracking-tight">
              {store.name}
            </span>
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
