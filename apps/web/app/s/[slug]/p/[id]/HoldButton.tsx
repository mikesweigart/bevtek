"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function HoldButton({
  storeSlug,
  itemId,
  itemName,
}: {
  storeSlug: string;
  itemId: string;
  itemName: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error: rpcErr } = await supabase.rpc("request_hold", {
      p_store_slug: storeSlug,
      p_item_id: itemId,
      p_customer_name: String(fd.get("name") ?? ""),
      p_customer_phone: String(fd.get("phone") ?? "") || null,
      p_customer_email: String(fd.get("email") ?? "") || null,
      p_quantity: parseInt(String(fd.get("quantity") ?? "1"), 10) || 1,
      p_notes: String(fd.get("notes") ?? "") || null,
    });
    setSubmitting(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-lg border-2 border-[color:var(--color-gold)] bg-gradient-to-br from-white to-[#FBF7F0] p-5 space-y-2">
        <p className="text-sm font-semibold">
          ✓ Hold request sent
        </p>
        <p className="text-sm text-[color:var(--color-muted)]">
          We&apos;ll text or email you when staff confirms your {itemName} is
          set aside. Pick up within 24 hours.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-3 text-sm font-semibold transition-colors"
      >
        Hold this for me
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-[color:var(--color-border)] p-5 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Hold request</p>
          <p className="text-xs text-[color:var(--color-muted)]">
            We&apos;ll set aside {itemName} for 24 hours.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
        >
          ✕
        </button>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-medium">Your name</span>
        <input
          name="name"
          required
          className="w-full rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium">Phone</span>
          <input
            name="phone"
            type="tel"
            placeholder="+1…"
            className="w-full rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium">Quantity</span>
          <input
            name="quantity"
            type="number"
            min={1}
            max={50}
            defaultValue={1}
            className="w-full rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]"
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-medium">Email (optional)</span>
        <input
          name="email"
          type="email"
          className="w-full rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-medium">Notes (optional)</span>
        <textarea
          name="notes"
          rows={2}
          placeholder="Gift wrap? Pickup time?"
          className="w-full rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]"
        />
      </label>
      <p className="text-[10px] text-[color:var(--color-muted)]">
        We need either a phone or email to confirm your hold.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Send hold request"}
      </button>
    </form>
  );
}
