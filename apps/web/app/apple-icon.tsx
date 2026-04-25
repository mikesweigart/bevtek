import { ImageResponse } from "next/og";

// Image metadata — Next.js reads these to emit the right <link rel="apple-touch-icon">
// tag with sizes="180x180" and the matching content-type.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS home-screen icon. iOS doesn't use the manifest's icons array
 * (only Chrome/Edge/Firefox do for installs); it pulls
 * <link rel="apple-touch-icon" href="/apple-icon"> instead. Same
 * brand treatment as the other PNG icons — gold field, white "B".
 *
 * iOS adds its own corner mask (rounded square), so we don't need
 * a separate maskable variant. iOS also adds a subtle inner shadow
 * automatically; resist the urge to fake one in the artwork.
 */
const BRAND_GOLD = "#c8984e";

export default function AppleIcon() {
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
        B
      </div>
    ),
    { ...size },
  );
}
