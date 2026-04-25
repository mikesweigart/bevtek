"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { switchStoreAction } from "./switchStoreAction";

export type SwitcherStore = {
  id: string;
  name: string;
  orgName: string | null;
  role: string;
};

/**
 * Header chip that shows the current store and, if the user belongs to
 * more than one, opens a dropdown for switching.
 *
 * Single-store users see a plain text label (no chevron, no click). Users
 * with multiple stores get a button that opens a menu grouped by
 * organization — consultants and chain operators routinely belong to
 * several orgs, so grouping makes the list scan-able.
 *
 * The server action reloads the page after flipping users.store_id. We
 * don't optimistically update anything because virtually every RLS check
 * in the app depends on the current store and would be stale until the
 * new render.
 */
export function StoreSwitcher({
  currentStoreId,
  currentStoreName,
  stores,
}: {
  currentStoreId: string;
  currentStoreName: string;
  stores: SwitcherStore[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  // Dismiss on outside click. useRef + document listener rather than a
  // library so we don't pull in anything for a 50-line component.
  useEffect(() => {
    if (!open) return;
    function handleDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [open]);

  if (stores.length <= 1) {
    return (
      <span className="text-sm text-[color:var(--color-muted)]">
        {currentStoreName}
      </span>
    );
  }

  // Group by organization for readability.
  const byOrg = new Map<string, SwitcherStore[]>();
  for (const s of stores) {
    const key = s.orgName ?? "—";
    const bucket = byOrg.get(key) ?? [];
    bucket.push(s);
    byOrg.set(key, bucket);
  }

  function handleSwitch(id: string) {
    if (id === currentStoreId || pending) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await switchStoreAction(id);
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="inline-flex items-center gap-1 text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)] disabled:opacity-60"
      >
        <span>{pending ? "Switching…" : currentStoreName}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path
            d="M2 4l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-64 max-h-96 overflow-auto rounded-md border border-[color:var(--color-border)] bg-white shadow-lg py-1.5 text-sm">
          {Array.from(byOrg.entries()).map(([orgName, list]) => (
            <div key={orgName}>
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest text-[color:var(--color-muted)]">
                {orgName}
              </div>
              {list.map((s) => {
                const isCurrent = s.id === currentStoreId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSwitch(s.id)}
                    disabled={pending}
                    className={`w-full text-left px-3 py-1.5 hover:bg-zinc-50 flex items-center justify-between gap-3 ${
                      isCurrent ? "font-medium" : ""
                    }`}
                  >
                    <span className="truncate">{s.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                        {s.role}
                      </span>
                      {isCurrent && (
                        <span className="text-[color:var(--color-gold)]">
                          ✓
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
