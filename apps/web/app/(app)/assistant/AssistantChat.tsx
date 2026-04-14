"use client";

import { useActionState, useRef, useEffect } from "react";
import { askAction, type AssistantState } from "./actions";

const initial: AssistantState = { error: null, query: null, results: [] };

export function AssistantChat() {
  const [state, action, pending] = useActionState(askAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pending) inputRef.current?.focus();
  }, [pending, state.query]);

  return (
    <div className="space-y-6">
      <form ref={formRef} action={action} className="flex gap-2">
        <input
          ref={inputRef}
          name="query"
          required
          placeholder="Do we have any peaty Scotch under $60?"
          className="flex-1 rounded-md border border-[color:var(--color-border)] px-4 py-3 text-sm outline-none focus:border-[color:var(--color-gold)]"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 text-sm font-medium disabled:opacity-60"
        >
          {pending ? "…" : "Ask"}
        </button>
      </form>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      {state.query && (
        <div className="space-y-3">
          <div className="text-sm text-[color:var(--color-muted)]">
            Search: <span className="text-[color:var(--color-fg)]">{state.query}</span>
          </div>
          {state.results.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[color:var(--color-border)] p-8 text-center">
              <p className="text-sm text-[color:var(--color-muted)]">
                Nothing matching in current inventory.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-[color:var(--color-border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-xs text-[color:var(--color-muted)]">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Name</th>
                      <th className="text-left px-4 py-2 font-medium">Brand</th>
                      <th className="text-left px-4 py-2 font-medium">Category</th>
                      <th className="text-right px-4 py-2 font-medium">Price</th>
                      <th className="text-right px-4 py-2 font-medium">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.results.map((r) => (
                      <tr
                        key={r.id}
                        className="border-t border-[color:var(--color-border)]"
                      >
                        <td className="px-4 py-2">{r.name}</td>
                        <td className="px-4 py-2 text-[color:var(--color-muted)]">
                          {r.brand ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-[color:var(--color-muted)]">
                          {r.category ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {r.price != null
                            ? `$${Number(r.price).toFixed(2)}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span
                            className={
                              r.stock_qty <= 0
                                ? "text-red-600"
                                : r.stock_qty < 5
                                  ? "text-amber-600"
                                  : ""
                            }
                          >
                            {r.stock_qty}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
