/**
 * Shared types for the Update Inventory moderation pipeline (historically
 * "Photo Mode").
 *
 * Every image submitted through Update Inventory runs through two classifiers
 * in series before it can touch the shared catalog:
 *
 *   1. OpenAI Moderation  — free tier, catches explicit/NSFW content
 *   2. Claude Haiku vision — ~$0.0003/image, confirms it's actually a product
 *
 * The combined result drives a four-state moderation_status:
 *
 *   approved  — safe AND looks like a product photo. Applied to catalog.
 *   rejected  — OpenAI flagged it as explicit / hate / violence. Auto-refused.
 *   flagged   — safe but Claude is suspicious (selfie, meme, blurry floor
 *               shot). Held for manager review; does NOT touch catalog.
 *   pending   — transient. Means moderation is in flight or errored.
 */

export type OpenAIModerationResult = {
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: Record<string, number>;
  /**
   * The highest-scoring category label, used for human-readable rejection
   * notes. e.g. "sexual", "violence", "hate".
   */
  top_category: string | null;
};

export type ClaudeVisionResult = {
  /** Claude's verdict: does this look like a beverage product photo? */
  is_product_photo: boolean;
  /** What Claude thinks it is — helps the manager triage flags. */
  product_type:
    | "bottle"
    | "can"
    | "box"
    | "other_product"
    | "person"
    | "scene"
    | "unclear"
    | "unknown";
  /** 0.0–1.0 — how confident Claude is in is_product_photo. */
  confidence: number;
  /** One short sentence from Claude for the manager gallery. */
  reasoning: string;
};

export type ModerationStatus = "approved" | "rejected" | "flagged" | "pending";

export type ModerationResult = {
  status: ModerationStatus;
  /** Raw per-provider scores. Stored as jsonb on catalog_image_submissions for audit. */
  scores: {
    openai?: OpenAIModerationResult;
    claude?: ClaudeVisionResult;
  };
  /** Human-readable reason. Shown in the manager gallery. */
  notes: string;
};
