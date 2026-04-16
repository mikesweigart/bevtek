const STEPS = [
  { key: "store", label: "Your store" },
  { key: "logo", label: "Branding" },
  { key: "inventory", label: "Inventory" },
  { key: "team", label: "Team" },
  { key: "done", label: "Launch" },
];

export function Stepper({ activeKey }: { activeKey: string }) {
  const idx = STEPS.findIndex((s) => s.key === activeKey);
  return (
    <ol className="flex items-center gap-2 mb-8">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={s.key} className="flex items-center gap-2 flex-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${
                active || done
                  ? "bg-[color:var(--color-gold)] text-white"
                  : "bg-zinc-200 text-zinc-500"
              }`}
            >
              {done ? "✓" : i + 1}
            </div>
            <span
              className={`text-xs whitespace-nowrap hidden sm:inline ${
                active
                  ? "text-[color:var(--color-fg)] font-medium"
                  : "text-[color:var(--color-muted)]"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px ${
                  done ? "bg-[color:var(--color-gold)]" : "bg-zinc-200"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
