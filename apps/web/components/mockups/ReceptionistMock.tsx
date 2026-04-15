// Megan Receptionist call log view.
export function ReceptionistMock() {
  const calls = [
    { from: "(404) 555-0182", time: "2m ago", dur: "1:42", status: "Order placed" },
    { from: "(404) 555-0199", time: "14m ago", dur: "0:38", status: "FAQ" },
    { from: "(770) 555-0138", time: "22m ago", dur: "2:14", status: "Order placed" },
    { from: "(678) 555-0147", time: "47m ago", dur: "0:22", status: "Missed" },
    { from: "(404) 555-0165", time: "1h ago", dur: "3:08", status: "Transferred" },
  ];
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-2 pb-3 border-b border-zinc-100">
        <p className="text-xs font-semibold">Receptionist</p>
        <p className="text-[9px] text-zinc-500">
          5 calls today · 4 handled by Megan
        </p>
      </div>
      <div className="flex-1 px-3 py-3 overflow-hidden">
        <div className="space-y-1.5">
          {calls.map((c, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded border border-zinc-100 p-2"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px]"
                style={{
                  background:
                    c.status === "Missed"
                      ? "#dc2626"
                      : "linear-gradient(135deg, #C8984E, #B8863C)",
                }}
              >
                📞
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium truncate">{c.from}</p>
                <p className="text-[8px] text-zinc-400">
                  {c.time} · {c.dur}
                </p>
              </div>
              <span
                className={`text-[8px] px-1.5 py-0.5 rounded whitespace-nowrap ${
                  c.status === "Missed"
                    ? "bg-red-50 text-red-700"
                    : c.status === "Order placed"
                      ? "bg-green-50 text-green-800"
                      : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {c.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
