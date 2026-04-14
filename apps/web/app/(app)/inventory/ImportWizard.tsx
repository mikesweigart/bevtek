"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  previewUploadAction,
  commitImportAction,
  type PreviewState,
  type ImportState,
} from "./actions";

const initialPreview: PreviewState = { error: null, preview: null };
const initialImport: ImportState = { error: null, inserted: null };

export function ImportWizard() {
  const [pState, pAction, pPending] = useActionState(
    previewUploadAction,
    initialPreview,
  );
  const [iState, iAction, iPending] = useActionState(
    commitImportAction,
    initialImport,
  );

  if (iState.inserted !== null) {
    return (
      <div className="rounded-lg border border-[color:var(--color-border)] p-6 space-y-3">
        <h2 className="text-lg font-semibold">Imported {iState.inserted} items</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Your inventory has been updated. Existing SKUs were replaced.
        </p>
        <div className="flex gap-2 pt-1">
          <Link
            href="/inventory"
            className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-4 py-2 text-sm font-medium"
          >
            View inventory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!pState.preview && (
        <form
          action={pAction}
          encType="multipart/form-data"
          className="rounded-lg border border-[color:var(--color-border)] p-6 space-y-4"
        >
          <div>
            <h2 className="text-lg font-semibold">Upload a spreadsheet</h2>
            <p className="text-sm text-[color:var(--color-muted)]">
              .xlsx, .xls, .csv, or .txt (tab-separated). Columns are
              auto-detected.
            </p>
          </div>
          <input
            type="file"
            name="file"
            required
            accept=".xlsx,.xls,.csv,.txt,.tsv"
            className="block text-sm"
          />
          {pState.error && (
            <p className="text-sm text-red-600">{pState.error}</p>
          )}
          <button
            type="submit"
            disabled={pPending}
            className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {pPending ? "Parsing…" : "Preview"}
          </button>
        </form>
      )}

      {pState.preview && (
        <div className="space-y-6">
          <div className="rounded-lg border border-[color:var(--color-border)] p-5 space-y-3">
            <h3 className="text-sm font-semibold">Column mapping</h3>
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              {Object.entries(pState.preview.mapping).map(([field, header]) => (
                <div
                  key={field}
                  className="flex items-center justify-between gap-2 rounded border border-[color:var(--color-border)] px-3 py-1.5"
                >
                  <span className="font-medium">{field}</span>
                  <span className="text-[color:var(--color-muted)] truncate">
                    {header}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[color:var(--color-border)] overflow-hidden">
            <div className="bg-zinc-50 px-4 py-2 text-xs text-[color:var(--color-muted)]">
              Showing {pState.preview.sample.length} of {pState.preview.total}{" "}
              rows
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-[color:var(--color-muted)]">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Name</th>
                    <th className="text-left px-4 py-2 font-medium">SKU</th>
                    <th className="text-left px-4 py-2 font-medium">Category</th>
                    <th className="text-right px-4 py-2 font-medium">Price</th>
                    <th className="text-right px-4 py-2 font-medium">Cost</th>
                    <th className="text-right px-4 py-2 font-medium">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {pState.preview.sample.map((r, idx) => (
                    <tr key={idx} className="border-t border-[color:var(--color-border)]">
                      <td className="px-4 py-2">{r.name}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.sku ?? "—"}</td>
                      <td className="px-4 py-2">{r.category ?? "—"}</td>
                      <td className="px-4 py-2 text-right">
                        {r.price != null ? `$${r.price.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {r.cost != null ? `$${r.cost.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">{r.stock_qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <form action={iAction} className="flex items-center gap-3">
            <input
              type="hidden"
              name="rowsB64"
              value={pState.preview.rowsB64}
            />
            <button
              type="submit"
              disabled={iPending}
              className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-medium disabled:opacity-60"
            >
              {iPending ? "Importing…" : `Import ${pState.preview.total} items`}
            </button>
            <Link
              href="/inventory/import"
              className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
            >
              Start over
            </Link>
            {iState.error && (
              <span className="text-sm text-red-600">{iState.error}</span>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
