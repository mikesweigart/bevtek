"use client";

import { useActionState } from "react";
import { updateProfileAction, type SettingsState } from "./actions";

const initial: SettingsState = { error: null, saved: false };

const inputCls =
  "w-full rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]";

export function ProfileForm({
  initialValues,
}: {
  initialValues: { full_name: string | null; email: string; role: string };
}) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);

  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Your name</span>
        <input
          name="full_name"
          defaultValue={initialValues.full_name ?? ""}
          className={inputCls}
        />
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Email</span>
          <input
            value={initialValues.email}
            readOnly
            className={`${inputCls} bg-zinc-50`}
          />
        </div>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Role</span>
          <input
            value={initialValues.role}
            readOnly
            className={`${inputCls} bg-zinc-50 capitalize`}
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && <p className="text-sm text-green-700">Saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-5 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
