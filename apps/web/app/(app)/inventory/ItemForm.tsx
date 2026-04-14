"use client";

import { useActionState, useState } from "react";
import {
  createItemAction,
  updateItemAction,
  type ItemFormState,
} from "./item-actions";
import { ImageUpload } from "@/components/ImageUpload";

const initial: ItemFormState = { error: null };

const inputCls =
  "w-full rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]";

type Initial = {
  id?: string;
  name?: string;
  sku?: string | null;
  brand?: string | null;
  category?: string | null;
  subcategory?: string | null;
  size_ml?: number | null;
  abv?: number | null;
  price?: number | null;
  cost?: number | null;
  stock_qty?: number;
  description?: string | null;
  tasting_notes?: string | null;
  image_url?: string | null;
  is_active?: boolean;
};

export function ItemForm({
  initialValues,
  storeId,
}: {
  initialValues?: Initial;
  storeId: string;
}) {
  const isEdit = Boolean(initialValues?.id);
  const [state, action, pending] = useActionState(
    isEdit ? updateItemAction : createItemAction,
    initial,
  );
  const [imageUrl, setImageUrl] = useState<string | null>(
    initialValues?.image_url ?? null,
  );

  return (
    <form action={action} className="space-y-6">
      {isEdit && <input type="hidden" name="id" value={initialValues!.id} />}
      <input type="hidden" name="image_url" value={imageUrl ?? ""} />

      <ImageUpload
        label="Product image"
        storeId={storeId}
        pathPrefix={`products/${initialValues?.id ?? "new"}`}
        value={imageUrl}
        onChange={setImageUrl}
        size="lg"
      />

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Name</span>
        <input
          name="name"
          required
          defaultValue={initialValues?.name ?? ""}
          className={inputCls}
        />
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Brand</span>
          <input
            name="brand"
            defaultValue={initialValues?.brand ?? ""}
            className={inputCls}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">SKU / barcode</span>
          <input
            name="sku"
            defaultValue={initialValues?.sku ?? ""}
            className={`${inputCls} font-mono`}
          />
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Category</span>
          <input
            name="category"
            defaultValue={initialValues?.category ?? ""}
            className={inputCls}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Subcategory</span>
          <input
            name="subcategory"
            defaultValue={initialValues?.subcategory ?? ""}
            className={inputCls}
          />
        </label>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Size (ml)</span>
          <input
            type="number"
            min={0}
            name="size_ml"
            defaultValue={initialValues?.size_ml ?? ""}
            className={inputCls}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">ABV (%)</span>
          <input
            type="number"
            step="0.1"
            min={0}
            name="abv"
            defaultValue={initialValues?.abv ?? ""}
            className={inputCls}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Price</span>
          <input
            type="number"
            step="0.01"
            min={0}
            name="price"
            defaultValue={initialValues?.price ?? ""}
            className={inputCls}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Cost</span>
          <input
            type="number"
            step="0.01"
            min={0}
            name="cost"
            defaultValue={initialValues?.cost ?? ""}
            className={inputCls}
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Stock</span>
        <input
          type="number"
          min={0}
          name="stock_qty"
          defaultValue={initialValues?.stock_qty ?? 0}
          className={`${inputCls} max-w-xs`}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Description</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={initialValues?.description ?? ""}
          className={inputCls}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Tasting notes</span>
        <textarea
          name="tasting_notes"
          rows={3}
          defaultValue={initialValues?.tasting_notes ?? ""}
          className={inputCls}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={initialValues?.is_active ?? true}
          className="accent-[color:var(--color-gold)]"
        />
        <span>Visible to customers</span>
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create item"}
        </button>
      </div>
    </form>
  );
}
