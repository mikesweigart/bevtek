import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * Per-store dynamic web app manifest. When a customer is browsing
 * /s/grapes-and-grains and "installs" the page, Chrome / Edge install a
 * PWA branded as Grapes & Grains, scoped to /s/grapes-and-grains/, with
 * the store's logo as the home-screen icon.
 *
 * Two important properties:
 *   - `scope: "/s/${slug}/"` — keeps every linked-out URL inside the
 *     installed app. If the customer follows a Megan recommendation to
 *     /s/${slug}/p/${id}, the PWA stays open. If they're sent to
 *     bevtek.ai/login, the system browser handles it instead.
 *   - `start_url: "/s/${slug}"` — opening from the home screen drops
 *     them on the store's catalog every time, no matter what page they
 *     installed from.
 *
 * We deliberately serve this as a Route Handler at .webmanifest rather
 * than colocate as `manifest.ts`, because Next.js 16's manifest file
 * convention is root-only (`app/manifest.ts` → `/manifest.webmanifest`).
 * Per-segment manifests must be explicit Route Handlers.
 *
 * The `manifest` <link> is wired up in /s/[slug]/layout.tsx via
 * generateMetadata so any /s/${slug}/* page advertises this manifest.
 */
export const runtime = "nodejs";

type StoreRow = {
  name: string;
  slug: string;
  logo_url: string | null;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_stores")
    .select("name, slug, logo_url")
    .eq("slug", slug)
    .maybeSingle();
  const store = data as StoreRow | null;

  if (!store) {
    // Don't 404 the manifest — return a placeholder so an in-flight
    // install attempt doesn't error in the browser console. The
    // browser will skip installation when there's no matching scope.
    return NextResponse.json(
      { name: "BevTek", short_name: "BevTek", start_url: "/" },
      { status: 404 },
    );
  }

  const base = `/s/${store.slug}`;

  return NextResponse.json(
    {
      name: store.name,
      short_name: store.name.slice(0, 12),
      description: `Shop ${store.name} online — powered by BevTek.`,
      start_url: base,
      scope: `${base}/`,
      id: base,
      display: "standalone",
      display_override: ["standalone", "minimal-ui"],
      orientation: "portrait",
      background_color: "#ffffff",
      theme_color: "#c8984e",
      categories: ["shopping", "lifestyle"],
      lang: "en-US",
      dir: "ltr",
      icons: [
        {
          src: `${base}/icons/icon-192`,
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: `${base}/icons/icon-512`,
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: `${base}/icons/icon-maskable`,
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        // Manifests are tiny and the browser only fetches one per
        // install — short cache so a logo change shows up quickly when
        // the merchant updates branding in Settings.
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
