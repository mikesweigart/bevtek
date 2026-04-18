// Shared types + constants for the age-gate. Lives outside the
// "use server" file because Next.js server-action files can only export
// async functions — anything else (types, constants) breaks the build.

export const AGE_COOKIE = "bevtek_age_21plus";
export const AGE_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export type AgeGateState = { error: string | null };
