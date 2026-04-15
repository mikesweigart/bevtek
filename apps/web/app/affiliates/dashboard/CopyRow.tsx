"use client";

import { useState } from "react";

export function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm font-mono bg-white"
      />
      <button
        type="button"
        onClick={copy}
        className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-4 text-sm font-medium whitespace-nowrap"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
