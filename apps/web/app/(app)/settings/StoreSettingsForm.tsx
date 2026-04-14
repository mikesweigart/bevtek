"use client";

import { useActionState, useState } from "react";
import {
  updateStoreSettingsAction,
  type SettingsState,
} from "./actions";
import { ImageUpload } from "@/components/ImageUpload";

const initial: SettingsState = { error: null, saved: false };

const inputCls =
  "w-full rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]";

export function StoreSettingsForm({
  initialValues,
  storeId,
  shopperUrl,
  canEdit,
}: {
  initialValues: {
    name: string;
    slug: string | null;
    phone: string | null;
    timezone: string;
    logo_url: string | null;
  };
  storeId: string;
  shopperUrl: string | null;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateStoreSettingsAction,
    initial,
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(
    initialValues.logo_url ?? null,
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="logo_url" value={logoUrl ?? ""} />

      <ImageUpload
        label="Store logo"
        storeId={storeId}
        pathPrefix="logos"
        value={logoUrl}
        onChange={setLogoUrl}
        size="md"
      />

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Store name</span>
        <input
          name="name"
          required
          disabled={!canEdit}
          defaultValue={initialValues.name}
          className={inputCls}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">URL slug</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[color:var(--color-muted)] whitespace-nowrap">
            /s/
          </span>
          <input
            name="slug"
            disabled={!canEdit}
            defaultValue={initialValues.slug ?? ""}
            placeholder="good-vibes"
            className={`${inputCls} font-mono`}
          />
        </div>
        {shopperUrl && (
          <span className="text-[10px] text-[color:var(--color-muted)]">
            Public URL:{" "}
            <a
              href={shopperUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--color-gold)] underline font-mono"
            >
              {shopperUrl.replace(/^https?:\/\//, "")}
            </a>
          </span>
        )}
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Store phone</span>
          <input
            name="phone"
            type="tel"
            disabled={!canEdit}
            defaultValue={initialValues.phone ?? ""}
            className={inputCls}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Timezone</span>
          <select
            name="timezone"
            disabled={!canEdit}
            defaultValue={initialValues.timezone}
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

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && <p className="text-sm text-green-700">Saved.</p>}

      {canEdit && (
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      )}
      {!canEdit && (
        <p className="text-xs text-[color:var(--color-muted)]">
          Only the store owner can edit these settings.
        </p>
      )}
    </form>
  );
}
