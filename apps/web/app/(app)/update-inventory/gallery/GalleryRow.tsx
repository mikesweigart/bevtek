"use client";

/**
 * A single submission tile in the manager gallery.
 *
 * Shows the uploaded photo, the product it's for, who uploaded it, and
 * what the moderation pipeline said. Approved submissions get a "Reject"
 * button so a manager can pull back an auto-approve that slipped through.
 */

import Image from "next/image";
import { useTransition, useState } from "react";
import { rejectSubmissionAction } from "../actions";

type Props = {
  submission: {
    id: string;
    image_url: string;
    moderation_status: "pending" | "approved" | "flagged" | "rejected";
    moderation_notes: string | null;
    applied_to_catalog_at: string | null;
    rejected_at: string | null;
    created_at: string;
    submitted_by: string;
  };
  product: { id: string; canonical_name: string; brand: string | null } | null;
  submitter: {
    id: string;
    full_name: string | null;
    email: string;
    role: "owner" | "manager" | "staff";
  } | null;
};

export function GalleryRow({ submission, product, submitter }: Props) {
  const [isPending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  const isApproved = submission.moderation_status === "approved";
  const isRejected = submission.moderation_status === "rejected";

  function handleReject() {
    const ok = window.confirm(
      "Reject this photo? If it was applied to the catalog, the image will be cleared.",
    );
    if (!ok) return;
    setLocalError(null);
    startTransition(async () => {
      const res = await rejectSubmissionAction(submission.id);
      if (!res.ok) setLocalError(res.error ?? "Failed to reject.");
    });
  }

  return (
    <div className="rounded-lg border border-[color:var(--color-border)] overflow-hidden bg-white flex flex-col">
      <div className="aspect-square relative bg-zinc-50">
        <Image
          src={submission.image_url}
          alt={product?.canonical_name ?? "Submission"}
          fill
          sizes="(max-width:640px) 100vw, 33vw"
          className="object-contain"
          unoptimized
        />
        <StatusPill status={submission.moderation_status} />
      </div>
      <div className="p-3 text-sm flex-1 flex flex-col gap-1.5">
        <div className="font-medium truncate">
          {product?.canonical_name ?? "Unknown product"}
        </div>
        {product?.brand && (
          <div className="text-xs text-[color:var(--color-muted)] truncate">
            {product.brand}
          </div>
        )}
        <div className="text-xs text-[color:var(--color-muted)]">
          By {submitter?.full_name ?? submitter?.email ?? "unknown"} ·{" "}
          {formatRelativeDate(submission.created_at)}
        </div>
        {submission.moderation_notes && (
          <div className="text-xs text-[color:var(--color-muted)] italic border-t border-[color:var(--color-border)] pt-1.5 mt-1">
            {submission.moderation_notes}
          </div>
        )}
        {isApproved && submission.applied_to_catalog_at && (
          <div className="text-[10px] font-semibold tracking-wider uppercase text-green-700">
            Live in catalog
          </div>
        )}
      </div>
      {!isRejected && (
        <div className="p-3 pt-0">
          <button
            type="button"
            onClick={handleReject}
            disabled={isPending}
            className="w-full text-xs font-medium text-red-700 hover:bg-red-50 border border-red-200 rounded px-2 py-1.5 disabled:opacity-50"
          >
            {isPending ? "Rejecting…" : "Reject"}
          </button>
          {localError && (
            <p className="text-xs text-red-600 mt-1">{localError}</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Props["submission"]["moderation_status"] }) {
  const label = {
    pending: "Pending",
    approved: "Approved",
    flagged: "Needs review",
    rejected: "Rejected",
  }[status];
  const cls = {
    pending: "bg-zinc-100 text-zinc-700",
    approved: "bg-green-100 text-green-800",
    flagged: "bg-amber-100 text-amber-800",
    rejected: "bg-red-100 text-red-800",
  }[status];
  return (
    <span
      className={`absolute top-2 left-2 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full ${cls}`}
    >
      {label}
    </span>
  );
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const delta = Date.now() - d.getTime();
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}
