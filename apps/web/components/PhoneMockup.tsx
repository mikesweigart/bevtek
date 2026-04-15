import { type ReactNode } from "react";

// Pure-CSS iPhone-style frame that wraps any ReactNode content.
// Used on the landing page to show what each Megan feature looks like.
export function PhoneMockup({
  label,
  children,
  tint = "light",
}: {
  label: string;
  children: ReactNode;
  tint?: "light" | "dark";
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative rounded-[38px] p-[6px] shadow-2xl"
        style={{
          width: "260px",
          height: "534px",
          background: "linear-gradient(160deg, #1a1a1a 0%, #2c2c2c 100%)",
        }}
      >
        {/* Screen */}
        <div
          className={`relative w-full h-full rounded-[32px] overflow-hidden ${
            tint === "dark" ? "bg-zinc-900" : "bg-white"
          }`}
        >
          {/* Dynamic island */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-[22px] bg-black rounded-full z-20" />

          {/* Status bar */}
          <div className="relative z-10 flex items-center justify-between px-5 pt-2 text-[10px] font-semibold text-black">
            <span>9:41</span>
            <span className="opacity-0">placeholder</span>
            <span className="flex items-center gap-1">
              <SignalIcon />
              <WifiIcon />
              <BatteryIcon />
            </span>
          </div>

          {/* App content */}
          <div className="relative z-0 h-[calc(100%-28px)] overflow-hidden">
            {children}
          </div>
        </div>
      </div>
      <p className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)]">
        {label}
      </p>
    </div>
  );
}

function SignalIcon() {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="currentColor">
      <rect x="0" y="7" width="2" height="3" rx="0.5" />
      <rect x="3" y="5" width="2" height="5" rx="0.5" />
      <rect x="6" y="3" width="2" height="7" rx="0.5" />
      <rect x="9" y="0" width="2" height="10" rx="0.5" />
    </svg>
  );
}
function WifiIcon() {
  return (
    <svg width="14" height="10" viewBox="0 0 16 12" fill="currentColor">
      <path d="M8 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
      <path d="M8 8a4 4 0 013 1.3l1-1.3a6 6 0 00-8 0l1 1.3A4 4 0 018 8z" />
      <path d="M8 5a7 7 0 015 2l1-1.4a9 9 0 00-12 0l1 1.4a7 7 0 015-2z" />
      <path d="M8 2a10 10 0 017 2.8l1-1.3a12 12 0 00-16 0l1 1.3A10 10 0 018 2z" />
    </svg>
  );
}
function BatteryIcon() {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" fill="none">
      <rect
        x="0.5"
        y="0.5"
        width="19"
        height="9"
        rx="2"
        stroke="currentColor"
        strokeOpacity="0.4"
      />
      <rect x="2" y="2" width="16" height="6" rx="1" fill="currentColor" />
      <rect x="20" y="3" width="1.5" height="4" rx="0.5" fill="currentColor" />
    </svg>
  );
}
