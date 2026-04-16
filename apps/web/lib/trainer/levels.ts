// Level system for Megan Trainer.
// Derives level, progress, and next-level info from total stars.

export type LevelInfo = {
  name: string;
  index: number;
  minStars: number;
  nextMinStars: number | null;
  progressToNext: number; // 0..1
};

const LEVELS: ReadonlyArray<{ name: string; minStars: number }> = [
  { name: "Newcomer", minStars: 0 },
  { name: "Bronze Trainer", minStars: 10 },
  { name: "Silver Trainer", minStars: 30 },
  { name: "Gold Trainer", minStars: 60 },
  { name: "Elite", minStars: 100 },
];

export function levelForStars(totalStars: number): LevelInfo {
  let current = LEVELS[0];
  let currentIdx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (totalStars >= LEVELS[i].minStars) {
      current = LEVELS[i];
      currentIdx = i;
    }
  }
  const next = LEVELS[currentIdx + 1];
  const nextMin = next?.minStars ?? null;
  const progressToNext = nextMin
    ? (totalStars - current.minStars) / (nextMin - current.minStars)
    : 1;
  return {
    name: current.name,
    index: currentIdx,
    minStars: current.minStars,
    nextMinStars: nextMin,
    progressToNext: Math.max(0, Math.min(1, progressToNext)),
  };
}

// Category group → display metadata
export const CATEGORY_GROUPS: Record<
  string,
  { label: string; shortLabel: string; color: string }
> = {
  wine_france: {
    label: "Wine — France",
    shortLabel: "France",
    color: "#C8984E",
  },
  wine_usa: {
    label: "Wine — USA",
    shortLabel: "USA",
    color: "#C8984E",
  },
  wine_world: {
    label: "Wine — World",
    shortLabel: "World",
    color: "#C8984E",
  },
  spirits: { label: "Spirits", shortLabel: "Spirits", color: "#C8984E" },
  beer: { label: "Beer", shortLabel: "Beer", color: "#C8984E" },
  cocktails: { label: "Cocktails", shortLabel: "Cocktails", color: "#C8984E" },
  cocktail_recipes: {
    label: "Cocktail Recipes",
    shortLabel: "Recipes",
    color: "#C8984E",
  },
  sales_service: {
    label: "Sales & Service",
    shortLabel: "Sales",
    color: "#C8984E",
  },
  custom: { label: "Your Store", shortLabel: "Custom", color: "#6B7280" },
};

export const CATEGORY_ORDER = [
  "wine_france",
  "wine_usa",
  "wine_world",
  "spirits",
  "beer",
  "cocktails",
  "cocktail_recipes",
  "sales_service",
  "custom",
];
