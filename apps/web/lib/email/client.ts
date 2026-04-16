import { Resend } from "resend";

// Centralized Resend client. Returns null if no API key is configured —
// callers should treat email as best-effort and never block on it.
let cached: Resend | null = null;

export function getResend(): Resend | null {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  cached = new Resend(key);
  return cached;
}

// Default FROM. Resend's onboarding@resend.dev works without domain
// verification (good for MVP). Replace with team@bevtek.ai once your
// domain DNS is configured at resend.com → Domains.
export const FROM_EMAIL =
  process.env.BEVTEK_FROM_EMAIL ?? "BevTek <onboarding@resend.dev>";
