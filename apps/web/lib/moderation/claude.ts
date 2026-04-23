/**
 * Claude Haiku vision classifier — "is this a product photo?" gate.
 *
 * OpenAI Moderation catches explicit/unsafe content, but a bored employee
 * might upload a selfie, a meme, or a blurry floor shot — all perfectly
 * "safe" but useless to the catalog. Claude Haiku looks at the image and
 * tells us whether it's plausibly a beverage product photo.
 *
 * Cost: ~$0.0003 per image on claude-haiku-4-5. Trivial at scale.
 *
 * Docs: https://docs.claude.com/en/api/messages
 */

import type { ClaudeVisionResult } from "./types";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";
const API_VERSION = "2023-06-01";

/**
 * The prompt is deliberately terse. Claude is asked to emit strict JSON
 * matching ClaudeVisionResult. We parse it and fall back to `unknown` if
 * Claude returns anything malformed.
 */
const PROMPT = `You are classifying a photo submitted to a liquor-store product catalog. Look at the image and respond with ONLY a JSON object (no prose, no code fences) matching this exact shape:

{
  "is_product_photo": boolean,
  "product_type": "bottle" | "can" | "box" | "other_product" | "person" | "scene" | "unclear" | "unknown",
  "confidence": number between 0 and 1,
  "reasoning": "one short sentence"
}

Rules:
- is_product_photo = true ONLY if the image clearly shows a beverage product (bottle, can, box) as the subject. A photo of shelves or a store interior where no single product is the focus should be false.
- If the image contains a person's face as the primary subject, product_type = "person" and is_product_photo = false.
- Blurry, very dark, or unfocused images: is_product_photo = false, product_type = "unclear".
- confidence reflects how sure you are of is_product_photo — 0.9+ for clear cases, ~0.5 for ambiguous.`;

type ClaudeApiResponse = {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
};

/**
 * Call Claude Haiku with the image URL and parse its JSON verdict.
 *
 * Returns a ClaudeVisionResult. On parse failure, returns a safe-unknown
 * result with confidence 0 — the caller should treat that as a flag, not
 * an approval.
 */
export async function classifyImageWithClaude(
  imageUrl: string,
): Promise<ClaudeVisionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Claude classifier failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as ClaudeApiResponse;
  const text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";

  return parseClaudeJson(text);
}

/**
 * Parse Claude's JSON response. If parsing fails or fields are missing,
 * return a conservative unknown result with confidence 0 so the caller
 * treats the submission as flagged-for-review rather than approved.
 */
function parseClaudeJson(text: string): ClaudeVisionResult {
  // Strip code fences if Claude added them despite instructions.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      is_product_photo: false,
      product_type: "unknown",
      confidence: 0,
      reasoning: `Claude returned unparseable output: ${cleaned.slice(0, 120)}`,
    };
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      is_product_photo: false,
      product_type: "unknown",
      confidence: 0,
      reasoning: "Claude returned non-object JSON",
    };
  }

  const obj = parsed as Record<string, unknown>;
  const isProductPhoto = obj.is_product_photo === true;
  const productType = normalizeProductType(obj.product_type);
  const confidence =
    typeof obj.confidence === "number"
      ? Math.max(0, Math.min(1, obj.confidence))
      : 0;
  const reasoning =
    typeof obj.reasoning === "string"
      ? obj.reasoning.slice(0, 500)
      : "No reasoning provided";

  return {
    is_product_photo: isProductPhoto,
    product_type: productType,
    confidence,
    reasoning,
  };
}

function normalizeProductType(v: unknown): ClaudeVisionResult["product_type"] {
  const valid: Array<ClaudeVisionResult["product_type"]> = [
    "bottle",
    "can",
    "box",
    "other_product",
    "person",
    "scene",
    "unclear",
    "unknown",
  ];
  if (typeof v === "string" && (valid as string[]).includes(v)) {
    return v as ClaudeVisionResult["product_type"];
  }
  return "unknown";
}
