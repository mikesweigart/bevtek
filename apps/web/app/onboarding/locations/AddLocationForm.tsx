"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addLocationAction, type AddLocationState } from "./actions";

const initial: AddLocationState = { error: null, createdName: null };

const inputCls =
  "w-full rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]";

/**
 * Collapsed by default ("+ Add another location") so single-location
 * owners see a clean "Continue →" path. Expands in-place when clicked
 * and resets itself after each successful add so the owner can chain
 * multiple adds without navigating.
 */
export function AddLocationForm() {
  const [state, action, pending] = useActionState(addLocationAction, initial);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the form after a successful add so the fields are ready for
  // the next store. We leave the panel open — most multi-location
  // operators add all their stores in one sitting.
  useEffect(() => {
    if (state.createdName && formRef.current) {
      formRef.current.reset();
    }
  }, [state.createdName]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-dashed border-[color:var(--color-border)] py-3 text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)] hover:border-[color:var(--color-gold)]"
      >
        + Add another location
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-3 rounded-md border border-[color:var(--color-border)] p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">New location</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[color:var(--color-muted)] hover:underline"
        >
          Close
        </button>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-[color:var(--color-muted)]">
          Store name
        </span>
        <input
          name="store_name"
          required
          placeholder="Grapes & Grains — Midtown"
          className={inputCls}
        />
      </label>

      <div className="grid sm:grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-xs text-[color:var(--color-muted)]">
            Phone
          </span>
          <input name="phone" type="tel" className={inputCls} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-[color:var(--color-muted)]">
            Timezone
          </span>
          <select
            name="timezone"
            defaultValue="America/New_York"
            className={inputCls}
          >
            <option value="America/New_York">Eastern</option>
            <option value="America/Chicago">Central</option>
            <option value="America/Denver">Mountain</option>
            <option value="America/Phoenix">Mountain (Phoenix)</option>
            <option value="America/Los_Angeles">Pacific</option>
            <option value="America/Anchorage">Alaska</option>
            <option value="Pacific/Honolulu">Hawaii</option>
          </select>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-[color:var(--color-muted)]">
          Street address (optional)
        </span>
        <input name="address_line_1" className={inputCls} />
      </label>

      <div className="grid sm:grid-cols-3 gap-2">
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-xs text-[color:var(--color-muted)]">City</span>
          <input name="city" className={inputCls} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-[color:var(--color-muted)]">State</span>
          <input
            name="region"
            maxLength={3}
            placeholder="GA"
            className={`${inputCls} uppercase`}
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-[color:var(--color-muted)]">ZIP</span>
        <input name="postal_code" className={inputCls} />
      </label>

      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.createdName && (
        <p className="text-xs text-green-700">
          Added {state.createdName}. Add another or continue.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add location"}
      </button>
    </form>
  );
}
