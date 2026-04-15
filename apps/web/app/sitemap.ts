import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const hdrs = await headers();
  const base = `https://${hdrs.get("host") ?? "bevtek-web.vercel.app"}`;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/signup`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const supabase = await createClient();
  const { data: stores } = await supabase
    .from("public_stores")
    .select("slug")
    .not("slug", "is", null);

  const storeUrls: MetadataRoute.Sitemap = (
    (stores as { slug: string | null }[] | null) ?? []
  )
    .filter((s): s is { slug: string } => Boolean(s.slug))
    .map((s) => ({
      url: `${base}/s/${s.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

  return [...staticRoutes, ...storeUrls];
}
