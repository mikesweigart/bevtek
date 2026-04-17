"use client";

import { useState } from "react";

export function CheckoutButton({
  plan,
  label,
  highlight,
  disabled,
}: {
  plan: string;
  label: string;
  highlight: boolean;
  disabled: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleCheckout}
        disabled={disabled || loading}
        className={`block w-full rounded-md py-2.5 text-sm font-semibold text-center transition-colors ${
          highlight
            ? "bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white"
            : "border border-[color:var(--color-border)] hover:border-[color:var(--color-fg)]"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {loading ? "Redirecting to Stripe..." : label}
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}
    </div>
  );
}
