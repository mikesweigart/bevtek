"use client";

import { useActionState, useState } from "react";
import {
  updateStoreSettingsAction,
  type SettingsState,
} from "./actions";
import { ImageUpload } from "@/components/ImageUpload";
import { HoursEditor } from "./HoursEditor";
import type { HoursJson } from "@/lib/store/hours";

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
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    region: string | null;
    postal_code: string | null;
    country_code: string | null;
    hours_json: HoursJson;
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

      <div className="space-y-3 pt-2">
        <div>
          <h3 className="text-sm font-medium">Address</h3>
          <p className="text-xs text-[color:var(--color-muted)]">
            Used for sales-tax lookup and shown on the Shopper landing page.
          </p>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs text-[color:var(--color-muted)]">
            Street address
          </span>
          <input
            name="address_line_1"
            disabled={!canEdit}
            defaultValue={initialValues.address_line_1 ?? ""}
            placeholder="123 Main St"
            className={inputCls}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs text-[color:var(--color-muted)]">
            Suite / unit (optional)
          </span>
          <input
            name="address_line_2"
            disabled={!canEdit}
            defaultValue={initialValues.address_line_2 ?? ""}
            className={inputCls}
          />
        </label>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs text-[color:var(--color-muted)]">
              City
            </span>
            <input
              name="city"
              disabled={!canEdit}
              defaultValue={initialValues.city ?? ""}
              className={inputCls}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[color:var(--color-muted)]">
              State
            </span>
            <input
              name="region"
              disabled={!canEdit}
              defaultValue={initialValues.region ?? ""}
              placeholder="GA"
              maxLength={3}
              className={`${inputCls} uppercase`}
            />
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs text-[color:var(--color-muted)]">
              ZIP / postal code
            </span>
            <input
              name="postal_code"
              disabled={!canEdit}
              defaultValue={initialValues.postal_code ?? ""}
              className={inputCls}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs text-[color:var(--color-muted)]">
              Country
            </span>
            <select
              name="country_code"
              disabled={!canEdit}
              defaultValue={initialValues.country_code ?? "US"}
              className={inputCls}
            >
              <option value="US">United States</option>
              <option value="CA">Canada</option>
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div>
          <h3 className="text-sm font-medium">Hours</h3>
          <p className="text-xs text-[color:var(--color-muted)]">
            Gabby tells callers these hours and uses them to decide when to
            offer same-day pickup.
          </p>
        </div>
        <HoursEditor
          initial={initialValues.hours_json}
          disabled={!canEdit}
        />
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
