import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const revalidate = false;

/**
 * 512x512 maskable icon — Android may crop this into a circle, squircle,
 * teardrop, etc. depending on the launcher. The W3C spec defines the
 * "safe zone" as a circle with diameter = 80% of the icon (40% radius
 * from center). Anything outside that zone may be hidden.
 *
 * Implementation: full-bleed gold background (so no white edge ever
 * shows after cropping) + the "B" sized to fit comfortably inside the
 * 80% safe zone. Tested mentally against circular and squircle masks.
 */
const SIZE = 512;
// Safe zone is 80% of width; we draw the glyph at ~55% of canvas to be
// safely centred even after the launcher carves into the corners.
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
        }}
      >
        <div
          style={{
            width: "80%",
            height: "80%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontSize: 280,
            fontWeight: 700,
            fontFamily: "system-ui, sans-serif",
            letterSpacing: "-0.04em",
          }}
        >
          B
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
