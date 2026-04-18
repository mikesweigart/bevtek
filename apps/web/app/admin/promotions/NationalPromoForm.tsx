"use client";

// Inline form for creating a national campaign. Uses useActionState so
// the admin sees the resulting error/success right on the form without
// a full page reload. Kept minimal on purpose — v1 just needs brand/
// category/UPC targeting, a window, and a revenue share.

import { useActionState } from "react";
import {
  createNationalPromotionAction,
  type CreateNationalState,
} from "./actions";

const initialState: CreateNationalState = { error: null, id: null };

export function NationalPromoForm() {
  const [state, formAction, pending] = useActionState(
    createNationalPromotionAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="rounded-lg border border-[color:var(--color-border)] bg-white p-4 space-y-3"
    >
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="Title *" name="title" placeholder="Bacardí Summer Sippin'" />
        <Field
          label="Tagline"
          name="tagline"
          placeholder="Refreshing. Smooth. Island-inspired."
        />
      </div>

      <fieldset className="space-y-2 rounded-md border border-[color:var(--color-border)] p-3">
        <legend className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)] px-1">
          Match against store inventory · fill at least one
        </legend>
        <div className="grid md:grid-cols-3 gap-3">
          <Field
            label="Brand (ilike)"
            name="brand"
            placeholder="bacardí"
            hint="Fuzzy match on inventory.brand"
          />
          <Field
            label="Category (exact)"
            name="category"
            placeholder="Rum"
            hint="Exact match on inventory.category"
          />
          <Field
            label="UPC"
            name="upc"
            placeholder="080480280017"
            hint="Exact — best targeting"
            mono
          />
        </div>
      </fieldset>

      <div className="grid md:grid-cols-3 gap-3">
        <Field
          label="Days to run"
          name="days"
          type="number"
          defaultValue="30"
          hint="1–365"
        />
        <Field
          label="Store revenue share %"
          name="store_revenue_share_pct"
          type="number"
          defaultValue="10"
          hint="0–50"
        />
        <Field
          label="Priority"
          name="priority"
          type="number"
          defaultValue="100"
          hint="higher = shown first"
        />
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="text-xs text-[color:var(--color-muted)]">
          Campaign auto-activates immediately and runs across every store
          that has a matching in-stock product (unless the store opts out).
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-4 py-2 text-sm font-medium disabled:opacity-60 whitespace-nowrap"
        >
          {pending ? "Creating…" : "Create campaign"}
        </button>
      </div>

      {state.error && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}
      {state.id && !state.error && (
        <p className="text-xs text-green-700">
          ✓ Created campaign {state.id.slice(0, 8)}…
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  hint,
  type = "text",
  defaultValue,
  mono,
}: {
  label: string;
  name: string;
  placeholder?: string;
  hint?: string;
  type?: string;
  defaultValue?: string;
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs tracking-widest uppercase text-[color:var(--color-muted)]">
        {label}
      </span>
      <input
        name={name}
        placeholder={placeholder}
        type={type}
        defaultValue={defaultValue}
        className={`rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)] ${
          mono ? "font-mono text-xs" : ""
        }`}
      />
      {hint && (
        <span className="text-[10px] text-[color:var(--color-muted)]">
          {hint}
        </span>
      )}
    </label>
  );
}
