// Tasting notes — priority: external structured → LLM generation.
//
// If the UPC lookup gave us a real description (OFF's generic_name +
// ingredients_text), we normalize it into two sentences. Otherwise we
// ask Claude for ≤2 sentences in BevTek's voice, constrained tightly
// so we don't hallucinate vintages, regions, or awards.

import { getAnthropic } from "@/lib/ai/claude";
import type { ProductCore } from "../types";

const MAX_CHARS = 200;

export type TastingNotesResult = {
  tasting_notes: string | null;
  summary_for_customer: string | null;
  /** True iff we fell back to the LLM. Feeds confidence scoring. */
  generated: boolean;
};

/**
 * Best-effort notes generation.
 *
 * @param core       — product identity + category for LLM grounding
 * @param externalDesc — description text from a provider (OFF, etc.) if any
 */
export async function getTastingNotes(
  core: ProductCore,
  externalDesc: string | null,
): Promise<TastingNotesResult> {
  // Case 1: external description is usable as-is. Trim and return.
  if (externalDesc && externalDesc.trim().length >= 20) {
    const notes = clip(externalDesc, MAX_CHARS);
    return {
      tasting_notes: notes,
      summary_for_customer: null, // LLM fills this in a separate pass if needed
      generated: false,
    };
  }

  // Case 2: LLM fallback. Requires ANTHROPIC_API_KEY; otherwise null.
  const claude = getAnthropic();
  if (!claude) {
    return { tasting_notes: null, summary_for_customer: null, generated: false };
  }

  const prompt = buildPrompt(core);
  try {
    const res = await claude.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 400,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return {
        tasting_notes: null,
        summary_for_customer: null,
        generated: false,
      };
    }

    const parsed = parseResponse(block.text);
    return {
      tasting_notes: parsed.tasting_notes,
      summary_for_customer: parsed.summary_for_customer,
      generated: true,
    };
  } catch {
    return { tasting_notes: null, summary_for_customer: null, generated: false };
  }
}

function buildPrompt(core: ProductCore): string {
  const name = core.name;
  const brand = core.brand ? ` (brand: ${core.brand})` : "";
  const cat = core.category ? ` — category: ${core.category}` : "";
  const size = core.size_label ? ` — size: ${core.size_label}` : "";

  return `You are a beverage expert writing for a store's AI shopping assistant (Gabby).
Write tasting notes for this product based ONLY on widely-known, generic characteristics of the style/category. Do NOT invent vintages, awards, regions, or specific flavor descriptors you aren't confident are accurate.

Product: ${name}${brand}${cat}${size}

Return JSON with exactly two keys:
{
  "tasting_notes": "≤180 characters. Short, structured, factual. Example: 'Dark cherry, cocoa, and toasted oak. Full-bodied with firm tannins.'",
  "summary_for_customer": "≤240 characters. One friendly sentence Gabby would say. Example: 'If you like bold reds that feel like a steak dinner, this is the one.'"
}

If you cannot write either with confidence, return null for that field.
Output ONLY the JSON, no prose.`;
}

function parseResponse(text: string): {
  tasting_notes: string | null;
  summary_for_customer: string | null;
} {
  // Model sometimes wraps JSON in ```json fences. Strip them.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    const obj = JSON.parse(cleaned) as {
      tasting_notes?: string | null;
      summary_for_customer?: string | null;
    };
    return {
      tasting_notes: clean(obj.tasting_notes),
      summary_for_customer: clean(obj.summary_for_customer),
    };
  } catch {
    return { tasting_notes: null, summary_for_customer: null };
  }
}

function clean(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (t.length < 20) return null;
  return clip(t, MAX_CHARS);
}

function clip(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}
