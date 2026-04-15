// Megan Trainer module list for staff.
export function TrainerMock() {
  const modules = [
    {
      title: "Whiskey 101",
      dur: "12 min",
      category: "Spirits",
      status: "done" as const,
    },
    {
      title: "Wine Pairing Basics",
      dur: "18 min",
      category: "Wine",
      status: "inprogress" as const,
    },
    {
      title: "Serving Craft Beer",
      dur: "8 min",
      category: "Beer",
      status: "new" as const,
    },
    {
      title: "Store Opening Checklist",
      dur: "5 min",
      category: "Ops",
      status: "new" as const,
    },
  ];
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-2 pb-3 border-b border-zinc-100">
        <p className="text-xs font-semibold">Trainer</p>
        <p className="text-[9px] text-zinc-500">4 modules · 1 completed</p>
      </div>
      <div className="flex-1 px-3 py-3 space-y-2 overflow-hidden">
        {modules.map((m) => (
          <div
            key={m.title}
            className="rounded-lg border border-zinc-100 p-3 space-y-1.5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold leading-tight">
                {m.title}
              </p>
              {m.status === "done" && (
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-[color:var(--color-gold)] text-white whitespace-nowrap">
                  Done
                </span>
              )}
              {m.status === "inprogress" && (
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 whitespace-nowrap">
                  In progress
                </span>
              )}
            </div>
            <div className="flex gap-2 text-[8px] text-zinc-400">
              <span>{m.category}</span>
              <span>·</span>
              <span>{m.dur}</span>
            </div>
            {m.status === "inprogress" && (
              <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[color:var(--color-gold)] rounded-full"
                  style={{ width: "40%" }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
