import { ImageResponse } from "next/og";
import { loadStoreBranding } from "@/lib/store/branding";

export const runtime = "nodejs";
export const revalidate = 3600;

/**
 * Maskable variant. Android may crop into a circle/squircle/teardrop
 * depending on launcher; the spec defines a circular safe zone of 80%
 * of the icon. Critical content must live inside that zone.
 *
 * Implementation:
 *   - With logo: gold bleed (so cropping never reveals a white edge),
 *     logo lives in the inner 60% — well inside any plausible mask.
 *   - Without logo: gold field, monogram in the inner 60%.
 *
 * We deliberately don't reuse the /icon-512 background-white layout
 * here, because a cropped white square on top of an Android home
 * screen looks like a missing-asset placeholder.
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
            background: BRAND_GOLD,
          }}
        >
          {/* White inner pill keeps the logo legible against the gold,
              and acts as a brand-safe "card" inside the cropped area. */}
          <div
            style={{
              width: "60%",
              height: "60%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              borderRadius: SIZE * 0.06,
            }}
          >
            <img
              src={store.logoUrl}
              alt=""
              width={SIZE * 0.45}
              height={SIZE * 0.45}
              style={{ objectFit: "contain" }}
            />
          </div>
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
          {initial}
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
