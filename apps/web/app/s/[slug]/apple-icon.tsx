import { ImageResponse } from "next/og";
import { loadStoreBranding } from "@/lib/store/branding";

// Per-segment apple-icon. Next.js auto-injects
//   <link rel="apple-touch-icon" href="/s/${slug}/apple-icon?<id>" sizes="180x180">
// into every page rendered under /s/[slug]/*, so when an iOS user taps
// "Add to Home Screen" they get the BRANDED store icon, not BevTek.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const BRAND_GOLD = "#c8984e";

export default async function ShopperAppleIcon({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await loadStoreBranding(slug);

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
          <img
            src={store.logoUrl}
            alt=""
            width={size.width * 0.7}
            height={size.height * 0.7}
            style={{ objectFit: "contain" }}
          />
        </div>
      ),
      { ...size },
    );
  }

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
          fontSize: 124,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "-0.04em",
        }}
      >
        {initial}
      </div>
    ),
    { ...size },
  );
}
