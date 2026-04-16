import Link from "next/link";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col bg-zinc-50">
      <header className="border-b border-[color:var(--color-border)] bg-white">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            BevTek<span className="text-[color:var(--color-gold)]">.ai</span>
          </Link>
          <span className="text-xs text-[color:var(--color-muted)]">
            Setting up your account
          </span>
        </div>
      </header>
      <main className="flex-1 px-6 py-10">
        <div className="max-w-2xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
