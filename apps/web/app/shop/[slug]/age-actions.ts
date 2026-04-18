"use server";

// Age-gate server actions. Sets a 30-day cookie on confirmation.
//
// IMPORTANT: Files marked "use server" can ONLY export async functions.
// Types and constants live in ./age-types.ts so this module stays valid
// when compiled through Next's server-action bundler.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { AGE_COOKIE, AGE_COOKIE_MAX_AGE_SECONDS, type AgeGateState } from "./age-types";

export async function confirmAgeAction(
  _prev: AgeGateState,
  formData: FormData,
): Promise<AgeGateState> {
  if (formData.get("confirmed") !== "yes") {
    return { error: "Please confirm you are 21 or older." };
  }

  const jar = await cookies();
  jar.set(AGE_COOKIE, new Date().toISOString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AGE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });

  // Force the shop page to re-render without the gate — the server
  // component will now see the cookie and skip the AgeGate render.
  revalidatePath("/shop");
  return { error: null };
}

/**
 * Server-side check: has this visitor confirmed 21+? Used by shop pages
 * and any other alcohol-restricted surface to decide whether to render
 * or show the gate.
 */
export async function hasConfirmedAge(): Promise<boolean> {
  const jar = await cookies();
  const v = jar.get(AGE_COOKIE)?.value;
  if (!v) return false;
  // Sanity-check the timestamp — if someone's cookie is older than
  // maxAge (clock skew / manual insert), treat as unverified.
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return false;
  const ageMs = Date.now() - t;
  if (ageMs < 0 || ageMs > AGE_COOKIE_MAX_AGE_SECONDS * 1000) return false;
  return true;
}
