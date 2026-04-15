// Staff floor assistant (Megan Assistant) as seen on a phone.
export function AssistantMock() {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-2 pb-3 border-b border-zinc-100">
        <p className="text-xs font-semibold">Assistant</p>
        <p className="text-[9px] text-zinc-500">
          Ask Megan about any product
        </p>
      </div>
      <div className="px-3 py-3 space-y-2">
        <div className="rounded-lg border-2 border-[color:var(--color-gold)] bg-white h-8 flex items-center px-3 text-[10px] text-zinc-700">
          Peaty Scotch under $60
        </div>
        <div className="flex flex-wrap gap-1">
          {["bourbon under $50", "gift", "dry red"].map((s) => (
            <span
              key={s}
              className="text-[8px] px-2 py-0.5 rounded-full border border-zinc-200 text-zinc-400"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="px-3 pb-3 flex-1 overflow-hidden">
        <p className="text-[8px] uppercase tracking-widest text-zinc-400 mb-1.5">
          3 matches
        </p>
        <div className="space-y-1.5">
          {[
            { name: "Laphroaig 10", cat: "Islay · 750ml", price: "$52.99", stock: 8 },
            { name: "Bowmore 12", cat: "Islay · 750ml", price: "$54.99", stock: 12 },
            { name: "Talisker 10", cat: "Skye · 750ml", price: "$58.99", stock: 3 },
          ].map((r) => (
            <div
              key={r.name}
              className="flex items-center gap-2 rounded border border-zinc-100 p-1.5"
            >
              <div
                className="w-8 h-8 rounded flex-shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg, #FBF7F0 0%, #EED9B8 100%)",
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium truncate">{r.name}</p>
                <p className="text-[8px] text-zinc-400">{r.cat}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold text-[color:var(--color-gold)]">
                  {r.price}
                </p>
                <p
                  className={`text-[8px] ${r.stock < 5 ? "text-amber-600" : "text-zinc-500"}`}
                >
                  {r.stock} left
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
