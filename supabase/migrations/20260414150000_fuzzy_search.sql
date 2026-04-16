-- pg_trgm extension for fuzzy / typo-tolerant search on inventory.
-- Used by Megan Assistant to handle misspellings, partial matches, etc.
-- "burbon" matches "Bourbon", "lagavuln" matches "Lagavulin 16", etc.

create extension if not exists pg_trgm;

-- GIN trigram indexes on the most-searched columns.
create index if not exists inventory_name_trgm_idx
  on public.inventory using gin (name gin_trgm_ops);
create index if not exists inventory_brand_trgm_idx
  on public.inventory using gin (brand gin_trgm_ops);
create index if not exists inventory_category_trgm_idx
  on public.inventory using gin (category gin_trgm_ops);

-- RPC for fuzzy inventory search — returns items sorted by best match.
-- Called by Megan Assistant (both web and mobile) with the raw user query.
-- Falls back gracefully: tries trigram similarity first, then ilike.

create or replace function public.fuzzy_search_inventory(
  p_query   text,
  p_limit   int default 20
) returns table (
  id        uuid,
  name      text,
  brand     text,
  category  text,
  price     numeric,
  stock_qty int,
  sku       text,
  score     real
)
language sql
stable
security invoker
as $$
  select
    i.id, i.name, i.brand, i.category, i.price, i.stock_qty, i.sku,
    greatest(
      similarity(i.name, p_query),
      similarity(coalesce(i.brand, ''), p_query),
      similarity(coalesce(i.category, ''), p_query)
    ) as score
  from public.inventory i
  where i.is_active = true
    and (
      i.name % p_query
      or i.brand % p_query
      or i.category % p_query
    )
  order by score desc, i.stock_qty desc
  limit p_limit;
$$;

comment on function public.fuzzy_search_inventory is
  'Trigram fuzzy search across inventory name/brand/category. Returns items ranked by similarity score.';

grant execute on function public.fuzzy_search_inventory(text, int) to authenticated;
