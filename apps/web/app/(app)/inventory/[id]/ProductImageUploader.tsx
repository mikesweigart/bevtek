"use client";

// Inline image override on the product detail page. Owners who don't
// like the auto-enriched photo drop in a new one here — it uploads to
// Supabase Storage, saves the public URL on the row, and flags
// image_source='manual' so the enrichment pipeline won't overwrite it.
//
// Opens as a compact "Replace photo" button that expands to the full
// drop-zone UI on click. Keeps the detail-page left column tidy while
// still one click from doing the override.

import { useState } from "react";
import { ImageUpload } from "@/components/ImageUpload";
import { setProductImageAction } from "../item-actions";

export function ProductImageUploader({
  inventoryId,
  storeId,
  currentImageUrl,
  isManual,
}: {
  inventoryId: string;
  storeId: string;
  currentImageUrl: string | null;
  isManual: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(currentImageUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function persist(url: string | null) {
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const fd = new FormData();
      fd.set("id", inventoryId);
      fd.set("image_url", url ?? "");
      await setProductImageAction(fd);
      setSaved(url ? "Saved — your photo is now live." : "Image cleared.");
    } catch (e) {
      setError((e as Error).message ?? "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-[color:var(--color-border)] px-3 py-1.5 text-xs hover:border-[color:var(--color-fg)]"
        title="Upload a replacement photo for this product"
      >
        📷 {isManual ? "Change photo" : "Replace photo"}
      </button>
    );
  }

  return (
    <div className="rounded-md border border-[color:var(--color-border)] bg-white p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-widest uppercase text-[color:var(--color-muted)]">
          Replace photo
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10px] text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
        >
          Close
        </button>
      </div>

      <ImageUpload
        storeId={storeId}
        pathPrefix={`products/${inventoryId}`}
        value={value}
        onChange={(url) => {
          setValue(url);
          // Persist immediately on upload success / clear so the owner
          // doesn't have to remember to hit a Save button.
          void persist(url);
        }}
        size="md"
      />

      {saving && (
        <p className="text-[10px] text-[color:var(--color-muted)]">Saving…</p>
      )}
      {saved && <p className="text-[10px] text-green-700">{saved}</p>}
      {error && <p className="text-[10px] text-red-600">{error}</p>}

      <p className="text-[10px] text-[color:var(--color-muted)] leading-snug">
        Custom uploads are locked in — the auto-enrichment pipeline won&apos;t
        overwrite them. Click Remove on the drop-zone to clear and let
        BevTek fetch a new one.
      </p>
    </div>
  );
}
