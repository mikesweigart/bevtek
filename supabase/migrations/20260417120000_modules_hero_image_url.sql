-- Add hero_image_url to modules so we can store verified keyword-matched photos
-- populated via the /api/admin/backfill-images Next.js route (Unsplash API).
-- Fallback to hardcoded mobile mappings when null.

alter table public.modules
  add column if not exists hero_image_url text,
  add column if not exists hero_image_credit text;

comment on column public.modules.hero_image_url is
  'Subject-verified hero photo URL (e.g. from Unsplash search per module topic). Null = use client-side fallback.';
comment on column public.modules.hero_image_credit is
  'Photographer credit for Unsplash attribution: "Photo by <name> on Unsplash".';
