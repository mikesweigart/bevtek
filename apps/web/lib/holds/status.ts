// Central reference for hold statuses.
//
// The DB layer uses historical names — `confirmed` is the live column
// value for what the spec calls "ready_at_front". This module exposes
// both forms so new code can write against spec names without another
// migration, and any UI can reach for a single canonical label/color
// mapping instead of redefining them per-page (which is how /holds
// and the dashboard drifted out of sync before).

export type HoldStatus =
  | "pending"
  | "in_progress"
  | "confirmed"
  | "picked_up"
  | "cannot_fulfill"
  | "cancelled"
  | "expired";

// Spec-name → DB-name bridge. Use these constants rather than typing
// the strings directly so a future rename becomes one edit here.
export const STATUS_REQUESTED: HoldStatus = "pending";
export const STATUS_IN_PROGRESS: HoldStatus = "in_progress";
export const STATUS_READY: HoldStatus = "confirmed";
export const STATUS_PICKED_UP: HoldStatus = "picked_up";
export const STATUS_CANNOT_FULFILL: HoldStatus = "cannot_fulfill";
export const STATUS_CANCELLED: HoldStatus = "cancelled";
export const STATUS_EXPIRED: HoldStatus = "expired";

export const ACTIVE_STATUSES: readonly HoldStatus[] = [
  STATUS_REQUESTED,
  STATUS_IN_PROGRESS,
  STATUS_READY,
] as const;

export type StatusMeta = {
  label: string;
  badgeBg: string;
  badgeFg: string;
  /** Short staff-facing blurb for the card header. */
  staffBlurb: string;
  /** Short customer-facing blurb. */
  customerBlurb: string;
};

export const STATUS_META: Record<HoldStatus, StatusMeta> = {
  pending: {
    label: "Requested",
    badgeBg: "#fef3c7",
    badgeFg: "#92400e",
    staffBlurb: "New request",
    customerBlurb: "Waiting for staff",
  },
  in_progress: {
    label: "Grabbing now",
    badgeBg: "#dbeafe",
    badgeFg: "#1e40af",
    staffBlurb: "You're on it",
    customerBlurb: "Staff is grabbing it",
  },
  confirmed: {
    label: "Ready at front",
    badgeBg: "#dcfce7",
    badgeFg: "#166534",
    staffBlurb: "Ready for pickup",
    customerBlurb: "Ready for pickup",
  },
  picked_up: {
    label: "Picked up",
    badgeBg: "#f3f4f6",
    badgeFg: "#4b5563",
    staffBlurb: "Done",
    customerBlurb: "Picked up",
  },
  cannot_fulfill: {
    label: "Unavailable",
    badgeBg: "#fee2e2",
    badgeFg: "#991b1b",
    staffBlurb: "Couldn't fulfill",
    customerBlurb: "Sorry — couldn't fulfill",
  },
  cancelled: {
    label: "Cancelled",
    badgeBg: "#f3f4f6",
    badgeFg: "#4b5563",
    staffBlurb: "Cancelled",
    customerBlurb: "Cancelled",
  },
  expired: {
    label: "Expired",
    badgeBg: "#f3f4f6",
    badgeFg: "#4b5563",
    staffBlurb: "Expired",
    customerBlurb: "Expired",
  },
};
