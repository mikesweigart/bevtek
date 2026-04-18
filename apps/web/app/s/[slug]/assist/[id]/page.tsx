import { notFound } from "next/navigation";
import { loadLiveSession } from "@/lib/assist/service";
import { getAssistServiceClient } from "@/lib/assist/service";
import AssistContinuation from "./AssistContinuation";

export const dynamic = "force-dynamic";

/**
 * Customer lands here after scanning the QR code an employee showed
 * them. Loads the in-progress conversation, shows it, and hands the
 * thread off to a client component that keeps chatting via the
 * /api/assist/[id]/message endpoint.
 *
 * Slug is part of the URL mostly for branding/trust — the session id
 * is the real capability. We still confirm the session belongs to the
 * store in the URL so a leaked id can't be hijacked to impersonate a
 * different store's conversation.
 */
export default async function AssistPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const svc = getAssistServiceClient();
  if (!svc) notFound();

  const { data: storeRow } = await svc
    .from("stores")
    .select("id, name, slug, logo_url")
    .eq("slug", slug)
    .maybeSingle();
  const store = storeRow as {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
  } | null;
  if (!store) notFound();

  const session = await loadLiveSession(id);
  if (!session || session.store_id !== store.id) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-3">
        <h1 className="text-xl font-semibold">This conversation has ended.</h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          Ask the staff to scan a fresh QR if you&rsquo;d like to keep going
          with Gabby.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
      <header className="flex items-center gap-3 mb-6">
        {store.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={store.logo_url}
            alt={store.name}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-[color:var(--color-gold)]/20" />
        )}
        <div>
          <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
            {store.name}
          </p>
          <h1 className="text-lg font-semibold">
            Continuing with Gabby
          </h1>
        </div>
      </header>

      <AssistContinuation
        sessionId={id}
        initialMessages={session.messages}
        expiresAt={session.expires_at}
      />
    </div>
  );
}
