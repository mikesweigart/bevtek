import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Paths reachable without a session.
//
// Apple App Review requires Support URL and Privacy Policy URL to be
// publicly accessible — a redirect to /login on these triggers rejection.
// Same courtesy for /terms since it's linked from the policy.
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/support",
  "/privacy",
  "/terms",
  "/robots.txt",
  "/sitemap.xml",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/auth/")) return true; // confirm, signout
  if (pathname.startsWith("/invite/")) return true; // invite acceptance
  if (pathname.startsWith("/s/")) return true; // Megan Shopper (customer-facing)
  if (pathname.startsWith("/api/")) return true; // webhooks
  if (pathname === "/affiliates") return true;
  if (pathname.startsWith("/affiliates/signup")) return true;
  if (pathname.startsWith("/affiliates/login")) return true;
  return false;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refresh the session cookie (required by @supabase/ssr).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Affiliate attribution: if ?ref=CODE is present, stamp a 90-day cookie
  // and fire-and-forget log the click via the public log_affiliate_click RPC.
  const refCode = request.nextUrl.searchParams.get("ref");
  if (refCode && /^[a-z0-9]{4,16}$/.test(refCode)) {
    const existing = request.cookies.get("bt_ref")?.value;
    if (existing !== refCode) {
      supabaseResponse.cookies.set("bt_ref", refCode, {
        maxAge: 60 * 60 * 24 * 90, // 90 days
        httpOnly: false,
        sameSite: "lax",
        path: "/",
      });
      // Best-effort click log. Awaited (fast RPC); errors are swallowed.
      try {
        await supabase.rpc("log_affiliate_click", {
          p_code: refCode,
          p_landing_path: pathname,
          p_user_agent: request.headers.get("user-agent"),
          p_referrer: request.headers.get("referer"),
          p_ip_hash: null,
        });
      } catch {
        // swallow; never block a page load on analytics
      }
    }
  }

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Trial expiry enforcement.
  //
  // Any authenticated user on a trial plan whose trial_ends_at has passed
  // gets routed to /billing with ?trial_expired=1. /billing is the one
  // app-shell page they can still reach because they need it to upgrade.
  // Non-trial plans (paid, grandfathered) are never gated.
  //
  // We deliberately skip:
  //   - Public paths (already handled above)
  //   - /billing and its children (so the upgrade flow works)
  //   - /auth/signout (so they can log out if they've walked away)
  //   - /settings (so an owner can still update email/profile while
  //     deciding whether to upgrade — nondestructive)
  //
  // One extra PostgREST query per gated page load. At pilot scale (< 100
  // stores) this is well under the latency budget. If it ever becomes
  // measurable, cache trial_ends_at in a cookie stamped at login — it
  // only changes on subscription events, which already clear cookies.
  if (
    user &&
    !isPublicPath(pathname) &&
    !pathname.startsWith("/billing") &&
    !pathname.startsWith("/settings") &&
    !pathname.startsWith("/auth/")
  ) {
    // Single-query join: users → stores so we don't double-round-trip.
    // The cast is needed because PostgREST returns embedded rows as
    // nested objects, which Supabase's generic typing can't infer.
    const { data: trialData } = await supabase
      .from("users")
      .select("stores(plan, trial_ends_at)")
      .eq("id", user.id)
      .maybeSingle();
    const storeInfo =
      (trialData as { stores: { plan: string | null; trial_ends_at: string | null } | null } | null)
        ?.stores ?? null;

    if (
      storeInfo?.plan === "trial" &&
      storeInfo.trial_ends_at &&
      new Date(storeInfo.trial_ends_at).getTime() < Date.now()
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/billing";
      url.searchParams.set("trial_expired", "1");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
