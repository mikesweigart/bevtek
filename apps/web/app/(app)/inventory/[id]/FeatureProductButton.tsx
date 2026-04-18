"use client";

// "Feature this product" — owner/manager shortcut on the inventory detail
// page. Opens a tiny inline form for title + tagline + duration. Submits
// to featureProductAction which creates (or extends) a store-kind promo.
//
// The promo appears on /shop/[slug] in the Featured row and (once wired)
// becomes a preferred recommendation inside Gabby's inventory context.

import { useActionState, useState } from "react";
import {
  featureProductAction,
  type FeatureProductState,
} from "@/app/(app)/promotions/actions";

type Props = {
  inventoryId: string;
  defaultTitle: string;
  defaultTagline: string | null;
  currentlyFeatured: boolean;
};

export function FeatureProductButton({
  inventoryId,
  defaultTitle,
  defaultTagline,
  currentlyFeatured,
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    FeatureProductState,
    FormData
  >(featureProductAction, { error: null, id: null });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-[color:var(--color-gold)] bg-[color:var(--color-gold)] text-white px-3 py-1.5 text-xs font-semibold hover:bg-[color:var(--color-gold-hover)]"
        title={
          currentlyFeatured
            ? "This product is featured — update its title or extend the run"
            : "Add this product to the Featured row on your storefront"
        }
      >
        ★ {currentlyFeatured ? "Update feature" : "Feature this product"}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-md border border-[color:var(--color-border)] bg-white p-3 space-y-2 text-xs"
    >
      <input type="hidden" name="inventory_id" value={inventoryId} />

      <label className="block">
        <span className="block text-[10px] tracking-widest uppercase text-[color:var(--color-muted)]">
          Feature title
        </span>
        <input
          name="title"
          defaultValue={defaultTitle}
          maxLength={80}
          required
          className="mt-1 w-full rounded border border-[color:var(--color-border)] px-2 py-1.5 text-xs"
        />
      </label>

      <label className="block">
        <span className="block text-[10px] tracking-widest uppercase text-[color:var(--color-muted)]">
          Tagline (optional)
        </span>
        <input
          name="tagline"
          defaultValue={defaultTagline ?? ""}
          maxLength={120}
          placeholder="Smooth on the rocks, perfect for a summer evening"
          className="mt-1 w-full rounded border border-[color:var(--color-border)] px-2 py-1.5 text-xs"
        />
      </label>

      <label className="block">
        <span className="block text-[10px] tracking-widest uppercase text-[color:var(--color-muted)]">
          Run for
        </span>
        <select
          name="days"
          defaultValue="14"
          className="mt-1 w-full rounded border border-[color:var(--color-border)] px-2 py-1.5 text-xs"
        >
          <option value="7">7 days</option>
          <option value="14">14 days</option>
          <option value="30">30 days</option>
          <option value="60">60 days</option>
        </select>
      </label>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white font-semibold py-1.5 text-xs disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : currentlyFeatured
              ? "Update"
              : "Feature product"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-[color:var(--color-border)] px-3 py-1.5 text-xs hover:border-[color:var(--color-fg)]"
        >
          Cancel
        </button>
      </div>

      {state.error && <p className="text-red-600 text-xs">{state.error}</p>}
      {!state.error && state.id && (
        <p className="text-green-700 text-xs">
          ✓ Featured on your storefront. Preview on /shop/your-store.
        </p>
      )}
    </form>
  );
}
