import { ImageResponse } from "next/og";
import { loadStoreBranding } from "@/lib/store/branding";

export const runtime = "nodejs";
// Icons rarely change post-onboarding. Cache an hour at the edge — we
// can short-circuit this if a merchant uploads a new logo by appending
// a cache-buster query in the manifest src later.
export const revalidate = 3600;

const SIZE = 192;
const BRAND_GOLD = "#c8984e";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const store = await loadStoreBranding(slug);

  // Logo present → white background with the logo centered. White is
  // the safest universal background; most store logos look fine on it,
  // and Android/iOS will overlay their own corner mask anyway.
  if (store?.logoUrl) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
          }}
        >
          {/* Padding ratio chosen so a square logo fits comfortably
              inside the platform mask without hugging the edges. */}
          <img
            src={store.logoUrl}
            alt=""
            width={SIZE * 0.7}
            height={SIZE * 0.7}
            style={{ objectFit: "contain" }}
          />
        </div>
      ),
      { width: SIZE, height: SIZE },
    );
  }

  // No logo (or unknown slug) → BevTek-style monogram with the store's
  // first letter, gold field. Gives every store an installable icon
  // even before they've uploaded artwork in Settings → Logo.
  const initial = store?.initial ?? "B";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_GOLD,
          color: "#ffffff",
          fontSize: 132,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "-0.04em",
        }}
      >
        {initial}
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
