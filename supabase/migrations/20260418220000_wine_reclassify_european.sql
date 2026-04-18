-- Reclassify European wine modules out of wine_world (now "International
-- Wines") and into wine_france (now relabeled "European Wines"). Keeps the
-- DB keys stable; only display labels in lib/trainer/levels.ts changed.
--
-- After this runs:
--   wine_usa   → American Wines (CA, OR, WA, etc.)
--   wine_france → European Wines (France + Italy + Spain + Germany + Portugal)
--   wine_world → International Wines (Argentina, Chile, Australia, NZ, ZA, JP)

update modules
set category_group = 'wine_france'
where category_group = 'wine_world'
  and (
    title ilike '%italy%'
    or title ilike '%italian%'
    or title ilike '%barolo%'
    or title ilike '%nebbiolo%'
    or title ilike '%chianti%'
    or title ilike '%montepulciano%'
    or title ilike '%pinot grigio%'
    or title ilike '%prosecco%'
    or title ilike '%spanish%'
    or title ilike '%spain%'
    or title ilike '%rioja%'
    or title ilike '%ribera%'
    or title ilike '%tempranillo%'
    or title ilike '%albariño%'
    or title ilike '%albarino%'
    or title ilike '%cava%'
    or title ilike '%german%'
    or title ilike '%germany%'
    or title ilike '%riesling%'
    or title ilike '%mosel%'
    or title ilike '%rheingau%'
    or title ilike '%portug%'
    or title ilike '%port wine%'
    or title ilike '%douro%'
    or title ilike '%madeira%'
    or title ilike '%austrian%'
    or title ilike '%gruner%'
    or title ilike '%grüner%'
    or title ilike '%greek%'
    or title ilike '%assyrtiko%'
  );

-- Visibility check (safe to run; prints what landed where).
-- select category_group, title from modules
--   where category_group in ('wine_usa','wine_france','wine_world')
--   order by category_group, position;
