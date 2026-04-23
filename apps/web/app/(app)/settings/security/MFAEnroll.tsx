"use client";

// MFA enrollment client component.
//
// Supabase Auth handles the factor lifecycle — enrollment returns a TOTP
// URI + QR SVG, verification promotes the factor to `verified`. We don't
// persist anything server-side ourselves; Supabase stores factors in its
// auth schema.
//
// Flow:
//   1. User clicks "Add authenticator"
//   2. enroll() returns { id, type, totp: { qr_code, secret, uri } }
//   3. User scans QR (or copies secret) into their authenticator app
//   4. User types the first 6-digit code → verify() promotes the factor
//   5. We refresh the list and show the new factor as "Active"
//
// If the user navigates away mid-enrollment, the unverified factor sticks
// around with status='unverified'. listFactors returns those too — we
// surface them as "Pending verification" with a resume/cancel option.

import { useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";

type Factor = {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: string;
  created_at: string;
};

type EnrollInProgress = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function MFAEnroll({
  initialFactors,
}: {
  initialFactors: Factor[];
}) {
  const supabase = createClient();
  const [factors, setFactors] = useState<Factor[]>(initialFactors);
  const [enrollment, setEnrollment] = useState<EnrollInProgress | null>(null);
  const [friendlyName, setFriendlyName] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refreshFactors() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.all ?? []) as Factor[]);
  }

  async function startEnroll() {
    setError(null);
    setNotice(null);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: friendlyName.trim() || undefined,
    });
    if (error) {
      setError(error.message);
      return;
    }
    if (!data) {
      setError("No data returned from enroll.");
      return;
    }
    setEnrollment({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
    await refreshFactors();
  }

  async function finishEnroll() {
    if (!enrollment) return;
    if (verifyCode.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(null);
    // Supabase's TOTP verify is a two-step: challenge() then verify().
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge(
      { factorId: enrollment.factorId },
    );
    if (chErr || !challenge) {
      setError(chErr?.message ?? "Couldn't create verification challenge.");
      return;
    }
    const { error: vfErr } = await supabase.auth.mfa.verify({
      factorId: enrollment.factorId,
      challengeId: challenge.id,
      code: verifyCode,
    });
    if (vfErr) {
      setError(vfErr.message);
      return;
    }
    setEnrollment(null);
    setFriendlyName("");
    setVerifyCode("");
    setNotice("Authenticator added. Use it on your next sign-in.");
    await refreshFactors();
  }

  async function cancelEnrollment() {
    if (!enrollment) return;
    // Clean up the unverified factor — otherwise it lingers in the list.
    await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
    setEnrollment(null);
    setFriendlyName("");
    setVerifyCode("");
    setError(null);
    await refreshFactors();
  }

  async function removeFactor(factorId: string) {
    const ok = window.confirm(
      "Remove this authenticator? You'll only be able to sign in with your password unless another factor is enrolled.",
    );
    if (!ok) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) setError(error.message);
      else setNotice("Authenticator removed.");
      await refreshFactors();
    });
  }

  return (
    <div className="space-y-6">
      {/* Factor list */}
      {factors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[color:var(--color-border)] p-4 text-sm text-[color:var(--color-muted)]">
          No authenticators enrolled yet.
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--color-border)] border border-[color:var(--color-border)] rounded-lg">
          {factors.map((f) => (
            <li key={f.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {f.friendly_name || "Authenticator"}
                </div>
                <div className="text-xs text-[color:var(--color-muted)] mt-0.5">
                  {f.factor_type.toUpperCase()} ·{" "}
                  {f.status === "verified" ? (
                    <span className="text-green-700 font-medium">
                      Active
                    </span>
                  ) : (
                    <span className="text-amber-700 font-medium">
                      Pending verification
                    </span>
                  )}{" "}
                  · added {new Date(f.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFactor(f.id)}
                disabled={isPending}
                className="text-xs font-medium text-red-700 hover:bg-red-50 border border-red-200 rounded px-3 py-1.5 disabled:opacity-50 shrink-0"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {notice && (
        <p className="text-sm text-green-700">{notice}</p>
      )}
      {error && (
        <p className="text-sm text-red-700">{error}</p>
      )}

      {/* Enroll flow */}
      {!enrollment ? (
        <div className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              Name this authenticator (optional)
            </span>
            <input
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="e.g. iPhone 1Password"
              className="rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-gold)]"
            />
          </label>
          <button
            type="button"
            onClick={startEnroll}
            className="rounded-md bg-[color:var(--color-gold)] text-white font-semibold px-4 py-2 text-sm"
          >
            Add authenticator
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-[color:var(--color-border)] p-4 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Scan this QR code</p>
            <p className="text-xs text-[color:var(--color-muted)]">
              Open Authy, 1Password, or Google Authenticator and add a new
              account by scanning this code.
            </p>
          </div>
          {/* Supabase returns the QR as an SVG data URI; render it directly. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrollment.qrCode}
            alt="TOTP QR code"
            className="w-40 h-40 bg-white rounded border border-[color:var(--color-border)] p-1"
          />
          <div className="space-y-1">
            <p className="text-xs text-[color:var(--color-muted)]">
              Can&rsquo;t scan? Enter this secret manually:
            </p>
            <code className="block text-xs font-mono break-all p-2 bg-zinc-50 rounded">
              {enrollment.secret}
            </code>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              Enter the 6-digit code from your app
            </span>
            <input
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
              className="rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm font-mono tracking-widest outline-none focus:border-[color:var(--color-gold)] max-w-[160px]"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={finishEnroll}
              className="rounded-md bg-[color:var(--color-gold)] text-white font-semibold px-4 py-2 text-sm"
            >
              Verify &amp; activate
            </button>
            <button
              type="button"
              onClick={cancelEnrollment}
              className="rounded-md border border-[color:var(--color-border)] px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
