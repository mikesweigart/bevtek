// Manager dashboard home — stats + 5 Megan cards.
export function DashboardMock() {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-2 pb-2 border-b border-zinc-100">
        <p className="text-[9px] text-zinc-500">Grapes &amp; Grains</p>
        <p className="text-xs font-semibold">Dashboard</p>
      </div>

      <div className="px-3 py-3 grid grid-cols-3 gap-1.5">
        {[
          { label: "Items", value: "847" },
          { label: "Team", value: "6" },
          { label: "Modules", value: "4" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded border border-zinc-100 px-2 py-1.5"
          >
            <p className="text-[7px] uppercase tracking-widest text-zinc-400">
              {s.label}
            </p>
            <p className="text-sm font-semibold mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 px-3 pb-3 overflow-hidden">
        <p className="text-[8px] uppercase tracking-widest text-zinc-400 mb-1.5">
          Megan
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            "Trainer",
            "Assistant",
            "Receptionist",
            "Shopper",
            "Texting",
          ].map((p) => (
            <div
              key={p}
              className="rounded border border-zinc-100 p-2 flex flex-col gap-1"
            >
              <div className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-[color:var(--color-gold)]" />
                <p className="text-[9px] font-semibold">Megan {p}</p>
              </div>
              <p className="text-[7px] text-zinc-500">Open →</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
