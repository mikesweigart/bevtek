// Mobile age gate — mirrors the web `bevtek_age_21plus` cookie semantics.
// 30-day TTL, persisted via expo-secure-store (already a dep for auth).
// Employees bypass post-login; customers see it before any content.
import * as SecureStore from "expo-secure-store";

const KEY = "bevtek_age_21plus";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AgeGateState = "unknown" | "confirmed" | "denied";

type Stored = { ok: boolean; at: number };

export async function getAgeState(): Promise<AgeGateState> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return "unknown";
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed || typeof parsed.at !== "number") return "unknown";
    if (Date.now() - parsed.at > TTL_MS) return "unknown";
    return parsed.ok ? "confirmed" : "denied";
  } catch {
    return "unknown";
  }
}

export async function setAgeConfirmed(ok: boolean): Promise<void> {
  const payload: Stored = { ok, at: Date.now() };
  await SecureStore.setItemAsync(KEY, JSON.stringify(payload));
}

export async function clearAgeState(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
