"use client";

// DMCA takedown form — public, no auth required.
//
// POSTs to /api/legal/dmca which writes to dmca_reports (service-role).
// Both sworn statements must be checked; the API route re-validates, and
// the CHECK constraints on the DB column are a belt-and-suspenders layer.

import { useState } from "react";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok"; referenceId: string }
  | { kind: "err"; message: string };

export function DMCAForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "submitting") return;
    setStatus({ kind: "submitting" });

    const form = new FormData(e.currentTarget);
    const payload = {
      claimant_name: (form.get("claimant_name") as string) ?? "",
      claimant_email: (form.get("claimant_email") as string) ?? "",
      claimant_phone: (form.get("claimant_phone") as string) ?? "",
      claimant_address: (form.get("claimant_address") as string) ?? "",
      claimant_authorized_to_act: form.get("claimant_authorized_to_act") === "on",
      copyrighted_work_description:
        (form.get("copyrighted_work_description") as string) ?? "",
      infringing_url: (form.get("infringing_url") as string) ?? "",
      good_faith_statement: form.get("good_faith_statement") === "on",
      accuracy_statement: form.get("accuracy_statement") === "on",
      signature: (form.get("signature") as string) ?? "",
    };

    try {
      const res = await fetch("/api/legal/dmca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        referenceId?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setStatus({
          kind: "err",
          message: data.error ?? `Submission failed (HTTP ${res.status}).`,
        });
        return;
      }
      setStatus({
        kind: "ok",
        referenceId: data.referenceId ?? "(no id returned)",
      });
    } catch (e) {
      setStatus({ kind: "err", message: (e as Error).message });
    }
  }

  if (status.kind === "ok") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 space-y-2">
        <p className="text-lg font-semibold text-green-900">
          Notice received.
        </p>
        <p className="text-sm text-green-900">
          Reference #{status.referenceId}. Our designated agent will respond
          within 5 business days. Keep this reference for your records.
        </p>
      </div>
    );
  }

  const submitting = status.kind === "submitting";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {status.kind === "err" && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {status.message}
        </div>
      )}

      <fieldset className="space-y-4">
        <legend className="text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
          Claimant information
        </legend>
        <Field
          name="claimant_name"
          label="Full legal name"
          required
          disabled={submitting}
        />
        <Field
          name="claimant_email"
          label="Email"
          type="email"
          required
          disabled={submitting}
        />
        <Field
          name="claimant_phone"
          label="Phone (optional)"
          disabled={submitting}
        />
        <Field
          name="claimant_address"
          label="Mailing address (optional)"
          disabled={submitting}
        />
        <Checkbox
          name="claimant_authorized_to_act"
          label="I am the copyright owner, or am authorized to act on behalf of the copyright owner."
          disabled={submitting}
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
          Allegedly infringing content
        </legend>
        <TextArea
          name="copyrighted_work_description"
          label="Description of your copyrighted work"
          required
          rows={3}
          disabled={submitting}
        />
        <Field
          name="infringing_url"
          label="URL of the allegedly infringing content"
          type="url"
          required
          placeholder="https://bevtek.ai/s/..."
          disabled={submitting}
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
          Sworn statements (both required)
        </legend>
        <Checkbox
          name="good_faith_statement"
          label="I have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law."
          disabled={submitting}
        />
        <Checkbox
          name="accuracy_statement"
          label="Under penalty of perjury, I swear that the information in this notice is accurate and that I am authorized to act on behalf of the copyright owner."
          disabled={submitting}
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xs uppercase tracking-widest text-[color:var(--color-muted)]">
          Electronic signature
        </legend>
        <Field
          name="signature"
          label="Type your full legal name as an electronic signature"
          required
          disabled={submitting}
        />
      </fieldset>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-[color:var(--color-gold)] text-white font-semibold px-5 py-3 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit DMCA notice"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  placeholder,
  disabled,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        className="rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)] disabled:opacity-60"
      />
    </label>
  );
}

function TextArea({
  name,
  label,
  required,
  rows,
  disabled,
}: {
  name: string;
  label: string;
  required?: boolean;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <textarea
        name={name}
        required={required}
        rows={rows ?? 3}
        disabled={disabled}
        className="rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)] disabled:opacity-60"
      />
    </label>
  );
}

function Checkbox({
  name,
  label,
  disabled,
}: {
  name: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        disabled={disabled}
        required
        className="mt-1 disabled:opacity-60"
      />
      <span>{label}</span>
    </label>
  );
}
