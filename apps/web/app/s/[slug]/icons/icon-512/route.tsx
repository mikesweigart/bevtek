import { ImageResponse } from "next/og";
import { loadStoreBranding } from "@/lib/store/branding";

export const runtime = "nodejs";
export const revalidate = 3600;

/**
 * 512x512 sibling of icon-192 — same logic, scaled artwork. Required
 * for Chrome's PWA install banner (it wants both 192 AND 512 to mark
 * the manifest installable).
 */
const SIZE = 512;
const BRAND_GOLD = "#c8984e";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
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
            width={SIZE * 0.7}
            height={SIZE * 0.7}
            style={{ objectFit: "contain" }}
          />
        </div>
      ),
      { width: SIZE, height: SIZE },
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
          fontSize: 352,
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
