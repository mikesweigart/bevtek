"use client";

import { useActionState } from "react";
import {
  createModuleAction,
  updateModuleAction,
  type ModuleFormState,
} from "./actions";

const initial: ModuleFormState = { error: null };

const inputCls =
  "w-full rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]";

type Initial = {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  duration_minutes?: number | null;
  body?: string;
  is_published?: boolean;
};

export function ModuleForm({ initialValues }: { initialValues?: Initial }) {
  const isEdit = Boolean(initialValues?.id);
  const [state, action, pending] = useActionState(
    isEdit ? updateModuleAction : createModuleAction,
    initial,
  );

  return (
    <form action={action} className="space-y-5">
      {isEdit && (
        <input type="hidden" name="id" value={initialValues!.id} />
      )}

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Title</span>
        <input
          name="title"
          required
          defaultValue={initialValues?.title ?? ""}
          className={inputCls}
          placeholder="Whiskey 101"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Description</span>
        <input
          name="description"
          defaultValue={initialValues?.description ?? ""}
          className={inputCls}
          placeholder="A short summary shown on the module list."
        />
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Category</span>
          <input
            name="category"
            defaultValue={initialValues?.category ?? ""}
            className={inputCls}
            placeholder="Spirits, Wine, Beer…"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Duration (minutes)</span>
          <input
            type="number"
            min={1}
            name="duration"
            defaultValue={initialValues?.duration_minutes ?? ""}
            className={inputCls}
            placeholder="10"
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Content</span>
        <textarea
          name="body"
          required
          rows={12}
          defaultValue={initialValues?.body ?? ""}
          className={`${inputCls} font-mono text-xs leading-relaxed`}
          placeholder="Markdown-style content. Keep it concise — staff read this on their phones."
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="publish"
          defaultChecked={initialValues?.is_published ?? true}
          className="accent-[color:var(--color-gold)]"
        />
        <span>Publish to staff</span>
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Saving…" : isEdit ? "Save changes" : "Create module"}
      </button>
    </form>
  );
}
