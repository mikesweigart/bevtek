import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const revalidate = false;

/**
 * 512x512 "any" icon — the larger sibling of icon-192. Required for
 * Chrome's PWA install banner (Chrome wants both 192 and 512 to call
 * the manifest installable). Same brand treatment, scaled up.
 */
const SIZE = 512;
const BRAND_GOLD = "#c8984e";

export async function GET() {
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
          fontSize: 352,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "-0.04em",
        }}
      >
        B
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
