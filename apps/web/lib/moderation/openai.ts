/**
 * OpenAI Moderation API — free-tier explicit-content gate.
 *
 * Uses omni-moderation-latest which supports image URLs directly (no base64
 * encoding required). We only pass the public URL of the just-uploaded image
 * in the store-media bucket.
 *
 * Docs: https://platform.openai.com/docs/guides/moderation
 *
 * The API returns categories like `sexual`, `violence`, `hate`, `self-harm`.
 * If ANY of them are flagged, we reject the submission outright.
 */

import type { OpenAIModerationResult } from "./types";

const ENDPOINT = "https://api.openai.com/v1/moderations";
const MODEL = "omni-moderation-latest";

type OpenAIApiResponse = {
  id: string;
  model: string;
  results: Array<{
    flagged: boolean;
    categories: Record<string, boolean>;
    category_scores: Record<string, number>;
  }>;
};

/**
 * Run the OpenAI moderation classifier against an image URL.
 *
 * Returns the flagged bool, per-category booleans, per-category scores, and
 * the top-scoring category label. Throws on network / auth failure — callers
 * should catch and treat as a "pending" moderation state (retry later).
 */
export async function moderateImageWithOpenAI(
  imageUrl: string,
): Promise<OpenAIModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: [{ type: "image_url", image_url: { url: imageUrl } }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI moderation failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as OpenAIApiResponse;
  const first = data.results?.[0];
  if (!first) {
    throw new Error("OpenAI moderation returned no results");
  }

  // Find the category with the highest score for human-readable notes.
  let topCategory: string | null = null;
  let topScore = 0;
  for (const [name, score] of Object.entries(first.category_scores ?? {})) {
    if (typeof score === "number" && score > topScore) {
      topScore = score;
      topCategory = name;
    }
  }

  return {
    flagged: first.flagged,
    categories: first.categories,
    category_scores: first.category_scores,
    top_category: topCategory,
  };
}
