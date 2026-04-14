"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX_BYTES = 5 * 1024 * 1024;

type Props = {
  storeId: string;
  /**
   * Path prefix inside the bucket, e.g. "logos" or `products/${itemId}`.
   * The store_id is prepended automatically to keep uploads RLS-safe.
   */
  pathPrefix: string;
  /** Current URL; used for preview and to show a Remove button. */
  value: string | null;
  onChange: (url: string | null) => void;
  /** Size of the preview area. */
  size?: "sm" | "md" | "lg";
  label?: string;
};

export function ImageUpload({
  storeId,
  pathPrefix,
  value,
  onChange,
  size = "md",
  label,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const dims = {
    sm: "w-24 h-24",
    md: "w-32 h-32",
    lg: "w-44 h-44",
  }[size];

  async function handleFile(file: File) {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Max file size is 5 MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const name = `${pathPrefix}/${Date.now()}.${ext}`;
      const fullPath = `${storeId}/${name}`;

      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("store-media")
        .upload(fullPath, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: "3600",
        });

      if (upErr) {
        setError(upErr.message);
        return;
      }

      const { data } = supabase.storage
        .from("store-media")
        .getPublicUrl(fullPath);

      onChange(data.publicUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {label && <span className="text-sm font-medium block">{label}</span>}
      <div className="flex items-start gap-4">
        <div
          className={`${dims} rounded-lg border bg-zinc-50 flex items-center justify-center overflow-hidden relative transition-colors ${
            dragOver
              ? "border-[color:var(--color-gold)] border-2"
              : "border-[color:var(--color-border)]"
          }`}
        >
          {value ? (
            <Image
              src={value}
              alt="Preview"
              fill
              sizes="176px"
              className="object-contain"
              unoptimized
            />
          ) : (
            <span className="text-[10px] text-[color:var(--color-muted)] text-center px-2">
              No image
            </span>
          )}
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={`flex-1 rounded-lg border border-dashed p-4 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-[color:var(--color-gold)] bg-amber-50/40"
              : "border-[color:var(--color-border)] hover:border-[color:var(--color-fg)]"
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          <p className="text-sm font-medium">
            {uploading ? "Uploading…" : "Drop image or click to browse"}
          </p>
          <p className="text-[10px] text-[color:var(--color-muted)] mt-1">
            PNG, JPG, WebP, or GIF · 5 MB max
          </p>
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="text-xs text-red-600 hover:underline mt-2"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
