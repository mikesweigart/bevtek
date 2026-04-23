/**
 * Update Inventory moderation pipeline (historically "Photo Mode") — combines
 * OpenAI Moderation + Claude Haiku into a single decision.
 *
 * Decision tree:
 *
 *   OpenAI flagged?
 *     YES  -> status = "rejected", note = "OpenAI flagged: {top_category}"
 *     NO   -> run Claude...
 *              Claude says is_product_photo && confidence >= 0.7
 *                YES  -> status = "approved"
 *                NO   -> status = "flagged"  (manager review queue)
 *
 * Fail-safe behavior: if EITHER classifier throws (network error, API key
 * missing, rate limit), we return status = "flagged" so a human looks at it
 * before it hits the catalog. Better to hold a good photo for 5 minutes than
 * ship a bad one to every store.
 */

import { moderateImageWithOpenAI } from "./openai";
import { classifyImageWithClaude } from "./claude";
import type { ModerationResult } from "./types";

export type { ModerationResult, ModerationStatus } from "./types";

/** Claude confidence floor for an auto-approve. Below this, we flag for review. */
const CLAUDE_APPROVE_FLOOR = 0.7;

/**
 * Run the full moderation pipeline on a publicly-accessible image URL
 * (typically the Supabase storage public URL we just uploaded to).
 *
 * Always resolves — never throws. On internal errors, returns a flagged
 * result so a human reviews the submission.
 */
export async function moderateImage(
  imageUrl: string,
): Promise<ModerationResult> {
  // Step 1: OpenAI explicit-content gate. Free and fast.
  let openaiResult;
  try {
    openaiResult = await moderateImageWithOpenAI(imageUrl);
  } catch (err) {
    return {
      status: "flagged",
      scores: {},
      notes: `OpenAI moderation errored; flagged for manual review. ${errorMessage(err)}`,
    };
  }

  if (openaiResult.flagged) {
    return {
      status: "rejected",
      scores: { openai: openaiResult },
      notes: `Auto-rejected by OpenAI moderation (category: ${openaiResult.top_category ?? "unknown"}).`,
    };
  }

  // Step 2: Claude "is-it-a-product" gate.
  let claudeResult;
  try {
    claudeResult = await classifyImageWithClaude(imageUrl);
  } catch (err) {
    return {
      status: "flagged",
      scores: { openai: openaiResult },
      notes: `Claude classifier errored; flagged for manual review. ${errorMessage(err)}`,
    };
  }

  const scores = { openai: openaiResult, claude: claudeResult };

  if (
    claudeResult.is_product_photo &&
    claudeResult.confidence >= CLAUDE_APPROVE_FLOOR
  ) {
    return {
      status: "approved",
      scores,
      notes: `Auto-approved. Claude: ${claudeResult.reasoning}`,
    };
  }

  // Not a product photo, or low confidence. Flag for manager review.
  return {
    status: "flagged",
    scores,
    notes: claudeResult.is_product_photo
      ? `Low confidence (${claudeResult.confidence.toFixed(2)}): ${claudeResult.reasoning}`
      : `Not a product photo (${claudeResult.product_type}): ${claudeResult.reasoning}`,
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
