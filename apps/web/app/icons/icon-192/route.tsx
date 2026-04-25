import { ImageResponse } from "next/og";

export const runtime = "nodejs";
// Cache the rendered PNG on Vercel's edge for a year. The URL is
// fingerprint-stable (no query params) so when we change the artwork
// we'll bump a version string in the manifest src to bust caches.
export const revalidate = false;

/**
 * 192x192 "any" icon — Chrome's minimum for PWA installability and
 * the canonical Android home-screen size. Background fills the full
 * canvas; the "B" sits centered with no inner padding because Android
 * wraps the icon in its own container.
 *
 * Color tokens match globals.css so a brand refresh only happens in
 * one file. If you change them here, change icon-512 + icon-maskable
 * + apple-icon.tsx + manifest.ts theme_color too.
 */
const SIZE = 192;
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
          fontSize: 132,
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
