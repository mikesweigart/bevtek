// Customer-facing storefront (Megan Shopper) as seen on a phone.
export function ShopperMock() {
  const items = [
    { name: "Lagavulin 16", brand: "Scotch", price: "$92.99", tint: "#F8E6BE" },
    { name: "Buffalo Trace", brand: "Bourbon", price: "$29.99", tint: "#EECBA0" },
    { name: "Casamigos Blanco", brand: "Tequila", price: "$49.99", tint: "#FBF0DC" },
    { name: "Veuve Clicquot", brand: "Champagne", price: "$59.99", tint: "#F3E4BE" },
  ];
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-2 pb-2 flex items-center gap-2 border-b border-zinc-100">
        <div className="w-7 h-7 rounded bg-[color:var(--color-gold)] flex items-center justify-center text-white text-xs font-semibold">
          G&amp;G
        </div>
        <span className="text-xs font-semibold">Grapes &amp; Grains</span>
      </div>
      <div className="px-3 py-2">
        <div className="rounded-lg bg-zinc-100 h-7 flex items-center px-3 text-[10px] text-zinc-500">
          Search the store
        </div>
      </div>
      <div className="px-3 flex gap-1.5 overflow-hidden">
        {["All", "Whiskey", "Wine", "Tequila"].map((c, i) => (
          <span
            key={c}
            className={`text-[9px] px-2 py-0.5 rounded-full border whitespace-nowrap ${
              i === 0
                ? "bg-[color:var(--color-gold)] text-white border-[color:var(--color-gold)]"
                : "border-zinc-200 text-zinc-500"
            }`}
          >
            {c}
          </span>
        ))}
      </div>
      <div className="flex-1 px-3 py-2 overflow-hidden">
        <div className="grid grid-cols-2 gap-2">
          {items.map((item) => (
            <div
              key={item.name}
              className="rounded-md border border-zinc-100 p-1.5 flex flex-col gap-1"
            >
              <div
                className="w-full h-16 rounded"
                style={{
                  background: `linear-gradient(135deg, #FBF7F0 0%, ${item.tint} 100%)`,
                }}
              />
              <p className="text-[8px] text-zinc-400 tracking-widest uppercase">
                {item.brand}
              </p>
              <p className="text-[10px] font-medium leading-tight truncate">
                {item.name}
              </p>
              <p className="text-[11px] font-semibold text-[color:var(--color-gold)]">
                {item.price}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
