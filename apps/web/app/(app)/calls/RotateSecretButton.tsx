"use client";

import { useState } from "react";
import { rotateReceptionistSecretAction } from "./actions";

export function RotateSecretButton({
  webhookUrl,
  initialSecret,
}: {
  webhookUrl: string;
  initialSecret: string | null;
}) {
  const [secret, setSecret] = useState<string | null>(initialSecret);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rotate() {
    setPending(true);
    setError(null);
    try {
      const res = await rotateReceptionistSecretAction();
      if (res.error) setError(res.error);
      else if (res.secret) setSecret(res.secret);
    } finally {
      setPending(false);
    }
  }

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <span className="text-xs font-medium">Webhook URL</span>
        <div className="flex gap-2">
          <input
            readOnly
            value={webhookUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 rounded-md border border-[color:var(--color-border)] px-3 py-2 text-xs font-mono bg-zinc-50"
          />
          <button
            type="button"
            onClick={() => copy(webhookUrl, "url")}
            className="rounded-md border border-[color:var(--color-border)] px-3 text-xs hover:border-[color:var(--color-fg)]"
          >
            {copied === "url" ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-xs font-medium">Webhook secret</span>
        <div className="flex gap-2">
          <input
            readOnly
            value={secret ?? "— click Generate to create —"}
            onFocus={(e) => e.currentTarget.select()}
            className={`flex-1 rounded-md border border-[color:var(--color-border)] px-3 py-2 text-xs font-mono ${
              secret ? "bg-zinc-50" : "bg-white text-[color:var(--color-muted)]"
            }`}
          />
          {secret && (
            <button
              type="button"
              onClick={() => copy(secret, "secret")}
              className="rounded-md border border-[color:var(--color-border)] px-3 text-xs hover:border-[color:var(--color-fg)]"
            >
              {copied === "secret" ? "Copied!" : "Copy"}
            </button>
          )}
          <button
            type="button"
            onClick={rotate}
            disabled={pending}
            className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-3 text-xs font-medium disabled:opacity-60"
          >
            {pending ? "…" : secret ? "Rotate" : "Generate"}
          </button>
        </div>
        {secret && (
          <p className="text-[10px] text-[color:var(--color-muted)]">
            Paste this secret into your Retell webhook config, under
            &ldquo;Custom header&rdquo; with name{" "}
            <code className="px-1 bg-zinc-100 rounded">x-webhook-secret</code>.
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
