"use client";

/**
 * Per-product description + tasting-notes editor.
 *
 * Rendered inside the Update Inventory session card when:
 *   1. The `update_inventory_details_edit` feature flag is on for the store.
 *   2. The current user is a manager/owner (RLS enforces this anyway, but we
 *      hide the UI from staff to avoid a frustrating click-then-reject).
 *
 * UX contract:
 *   - Collapsed by default — keeps the photo-first flow fast. One tap to
 *     expand.
 *   - Pre-fills each textarea with the store-level override if one exists,
 *     falling back to the catalog-level default (tasting notes only;
 *     catalog_products has no `description` column, so description is
 *     inventory-only).
 *   - Save button only lights up when something changed.
 *   - On save: call the server action, show a transient "Saved" pill, keep
 *     the panel expanded so the manager can keep tweaking.
 *
 * Scope deliberately limited: no markdown, no rich text, no review-submission
 * flow yet. Reviews land in a later pass once we've decided whether they're
 * per-product or per-SKU (inventory row vs catalog row).
 */

import { useState, useTransition } from "react";
import { updateInventoryDetailsAction } from "./actions";

export type DetailsEditProps = {
  inventoryId: string;
  /** Current per-store override (inventory.description). Null if none. */
  initialDescription: string | null;
  /** Current per-store override (inventory.tasting_notes). Null if none. */
  initialTastingNotes: string | null;
  /**
   * Catalog-level default tasting notes. Shown as a muted placeholder when
   * the store has no override, so the manager knows what the customer sees
   * today. Null if catalog has nothing either.
   */
  catalogTastingNotes: string | null;
};

// Keep this in sync with INVENTORY_DETAILS_MAX_CHARS in actions.ts. Client-
// side we cap via maxLength so the user sees the limit; server-side we
// truncate rather than reject so a trailing paste doesn't lose work.
const MAX_CHARS = 2000;

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function DetailsEdit(props: DetailsEditProps) {
  // Baselines move forward after a successful save. Lazy-init so we only
  // compute the trim() once per mount. Plain refs would also work but then
  // we'd need a `useEffect` to seed them from props, which is a footgun if
  // the key on the parent ever changes mid-session.
  const baselineDesc = useLazyRef(() => (props.initialDescription ?? "").trim());
  const baselineNotes = useLazyRef(() => (props.initialTastingNotes ?? "").trim());

  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState(
    props.initialDescription ?? "",
  );
  const [tastingNotes, setTastingNotes] = useState(
    props.initialTastingNotes ?? "",
  );
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  const descDirty = description.trim() !== baselineDesc.current;
  const notesDirty = tastingNotes.trim() !== baselineNotes.current;
  const dirty = descDirty || notesDirty;

  function onSave() {
    if (!dirty) return;
    setSave({ kind: "saving" });
    startTransition(async () => {
      const patch: Parameters<typeof updateInventoryDetailsAction>[0] = {
        inventoryId: props.inventoryId,
      };
      if (descDirty) patch.description = description.trim() || null;
      if (notesDirty) patch.tastingNotes = tastingNotes.trim() || null;

      const res = await updateInventoryDetailsAction(patch);
      if (!res.ok) {
        setSave({ kind: "error", message: res.error ?? "Couldn't save." });
        return;
      }
      // Advance baselines so the "dirty" indicator flips off and a second
      // save (with no further edits) is a no-op.
      baselineDesc.current = description.trim();
      baselineNotes.current = tastingNotes.trim();
      setSave({ kind: "saved" });
      // Flash saved-pill for a moment then return to idle.
      setTimeout(() => setSave({ kind: "idle" }), 1500);
    });
  }

  if (!expanded) {
    const hasAnyContent =
      baselineDesc.current.length > 0 || baselineNotes.current.length > 0;
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full rounded-lg border border-dashed border-[color:var(--color-border)] px-3 py-2 text-xs text-[color:var(--color-muted)] hover:bg-zinc-50 text-left"
      >
        ✏️ Edit details
        {hasAnyContent ? " (currently set)" : " (add description, tasting notes)"}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-white p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">
          Product details
        </p>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs text-[color:var(--color-muted)] hover:underline"
        >
          Collapse
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">Description (store-specific)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={MAX_CHARS}
          rows={3}
          disabled={isPending}
          placeholder="How would you describe this to a shopper on the floor?"
          className="rounded-md border border-[color:var(--color-border)] px-2 py-1.5 text-sm outline-none focus:border-[color:var(--color-gold)] disabled:opacity-60"
        />
        <span className="text-[10px] text-[color:var(--color-muted)] self-end">
          {description.length}/{MAX_CHARS}
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">
          Tasting notes
          {props.catalogTastingNotes &&
            baselineNotes.current.length === 0 &&
            " (catalog default shown — override below)"}
        </span>
        <textarea
          value={tastingNotes}
          onChange={(e) => setTastingNotes(e.target.value)}
          maxLength={MAX_CHARS}
          rows={4}
          disabled={isPending}
          placeholder={
            props.catalogTastingNotes ??
            "Leave blank to use the catalog default (none set yet)."
          }
          className="rounded-md border border-[color:var(--color-border)] px-2 py-1.5 text-sm outline-none focus:border-[color:var(--color-gold)] disabled:opacity-60"
        />
        <span className="text-[10px] text-[color:var(--color-muted)] self-end">
          {tastingNotes.length}/{MAX_CHARS}
        </span>
      </label>

      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-[color:var(--color-muted)] min-w-0">
          {save.kind === "saved" && (
            <span className="text-green-700">✓ Saved</span>
          )}
          {save.kind === "error" && (
            <span className="text-red-700 truncate block">{save.message}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || isPending || save.kind === "saving"}
          className="shrink-0 rounded-md bg-[color:var(--color-gold)] text-white font-semibold px-4 py-1.5 text-sm disabled:opacity-40"
        >
          {save.kind === "saving" ? "Saving…" : "Save details"}
        </button>
      </div>
    </div>
  );
}

// Tiny lazy-init ref helper — useRef(init) eagerly runs init every render.
// We want to run it exactly once. useState's lazy initializer does that;
// we throw away the setter since we mutate `.current` directly.
function useLazyRef<T>(init: () => T): { current: T } {
  const [box] = useState(() => ({ current: init() }));
  return box;
}
