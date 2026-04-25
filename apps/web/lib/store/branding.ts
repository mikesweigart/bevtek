import { createClient } from "@/utils/supabase/server";

/**
 * Branding fields needed to render a per-store icon. We fetch from
 * `public_stores` (the RLS-safe view that exposes the columns a logged-out
 * shopper is allowed to see) so the icon endpoints work for every visitor,
 * not just signed-in users.
 */
export type StoreBranding = {
  name: string;
  slug: string;
  logoUrl: string | null;
  /** Single uppercase letter to use as a logo-less fallback monogram. */
  initial: string;
};

/**
 * Look up a store's display name + logo for an installed-PWA icon. Returns
 * null if the slug doesn't exist (the icon endpoints turn that into a
 * neutral 404 PNG).
 *
 * Called from up to 4 different routes per install (192, 512, maskable,
 * apple). The caller-facing endpoint sets revalidate=3600 so we don't
 * hammer Postgres for icons that are basically static post-onboarding.
 */
export async function loadStoreBranding(
  slug: string,
): Promise<StoreBranding | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_stores")
    .select("name, slug, logo_url")
    .eq("slug", slug)
    .maybeSingle();
  const row = data as
    | { name: string; slug: string; logo_url: string | null }
    | null;
  if (!row) return null;
  // First grapheme of the trimmed name, uppercased. Falls back to "B"
  // (BevTek) on the absurd-but-possible empty-name case.
  const initial = (row.name.trim().charAt(0) || "B").toUpperCase();
  return {
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    initial,
  };
}
