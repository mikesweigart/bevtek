"use client";

/**
 * Mobile-first photo capture widget used by the Update Inventory session.
 *
 * This is intentionally simpler than components/ImageUpload.tsx:
 *   - One big "Take Photo" button on mobile (opens the rear camera via
 *     capture="environment").
 *   - On desktop it falls back to a file picker because desktops don't
 *     honor the `capture` attribute.
 *   - No drag-drop, no remove button — the session itself owns that UX.
 *   - After upload completes, we call onUploaded() with the public URL so
 *     the session can trigger server-side moderation.
 */

import { useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX_BYTES = 5 * 1024 * 1024;

type Props = {
  storeId: string;
  catalogProductId: string;
  /** Called with the just-uploaded public URL once the file is in the bucket. */
  onUploaded: (publicUrl: string) => void;
  /** Called when the user cancels or an error prevents upload. */
  onError?: (message: string) => void;
  disabled?: boolean;
};

export function PhotoCapture({
  storeId,
  catalogProductId,
  onUploaded,
  onError,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLocalError(null);

    if (!file.type.startsWith("image/")) {
      const msg = "Please choose an image file.";
      setLocalError(msg);
      onError?.(msg);
      return;
    }
    if (file.size > MAX_BYTES) {
      const msg = "Max file size is 5 MB.";
      setLocalError(msg);
      onError?.(msg);
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${storeId}/catalog/${catalogProductId}/${Date.now()}.${ext}`;

      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("store-media")
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: "3600",
        });

      if (upErr) {
        setLocalError(upErr.message);
        onError?.(upErr.message);
        return;
      }

      const { data } = supabase.storage.from("store-media").getPublicUrl(path);
      onUploaded(data.publicUrl);
    } catch (e) {
      const msg = (e as Error).message;
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        // capture="environment" tells iOS/Android to open the rear camera
        // directly. Desktops ignore it and show the normal file picker.
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={uploading || disabled}
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-xl bg-[color:var(--color-gold)] text-white font-semibold py-6 text-lg shadow-md active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {uploading ? "Uploading…" : "📷 Take Photo or Upload"}
      </button>
      {localError && (
        <p className="text-sm text-red-600 mt-2 text-center">{localError}</p>
      )}
    </div>
  );
}
