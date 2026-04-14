import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="block text-center mb-8 text-sm tracking-widest uppercase text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
        >
          BevTek
        </Link>
        {children}
      </div>
    </div>
  );
}
