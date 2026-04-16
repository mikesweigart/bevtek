// Level system matching the user's mockup design.
// "Bronze Trainer" shown at Level 2 in the mockup.

export type LevelInfo = {
  name: string;
  index: number;
  minStars: number;
  nextMinStars: number | null;
  progressToNext: number;
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

export const CATEGORY_BADGES: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  wine_france: { label: "WINE", color: "#92400E", bg: "#FEF3C7" },
  wine_usa: { label: "WINE", color: "#92400E", bg: "#FEF3C7" },
  wine_world: { label: "WINE", color: "#92400E", bg: "#FEF3C7" },
  spirits: { label: "SPIRITS", color: "#78350F", bg: "#FDE68A" },
  beer: { label: "BEER", color: "#3F6212", bg: "#ECFCCB" },
  cocktails: { label: "COCKTAILS", color: "#9A3412", bg: "#FFEDD5" },
  custom: { label: "CUSTOM", color: "#6B7280", bg: "#F3F4F6" },
};
