"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Dashboard", manager: false },
  { href: "/holds", label: "Holds", manager: false },
  { href: "/assistant", label: "Assistant", manager: false },
  { href: "/calls", label: "Calls", manager: true },
  { href: "/texts", label: "Texts", manager: true },
  { href: "/trainer", label: "Trainer", manager: false },
  { href: "/inventory", label: "Inventory", manager: false },
  { href: "/team", label: "Team", manager: true },
];

export function NavTabs({ isManager }: { isManager: boolean }) {
  const pathname = usePathname();
  const visible = TABS.filter((t) => !t.manager || isManager);

  return (
    <nav className="flex gap-6 -mb-px">
      {visible.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`py-3 text-sm border-b-2 transition-colors ${
              active
                ? "border-[color:var(--color-gold)] text-[color:var(--color-fg)]"
                : "border-transparent text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
