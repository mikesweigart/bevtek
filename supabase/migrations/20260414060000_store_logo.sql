-- Add a logo URL to stores for branding the customer-facing Shopper.
alter table public.stores
  add column if not exists logo_url text;

-- Expose it in the public view.
create or replace view public.public_stores
with (security_invoker = true) as
select id, name, slug, timezone, logo_url
from public.stores;

grant select on public.public_stores to anon, authenticated;
