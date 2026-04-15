import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="max-w-md text-center space-y-4">
        <p className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
          404
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="text-sm text-[color:var(--color-muted)]">
          The page you&apos;re looking for isn&apos;t here — maybe it moved, or
          maybe the link was wrong.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm font-medium border border-[color:var(--color-border)] hover:border-[color:var(--color-fg)] transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
