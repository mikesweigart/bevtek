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
  const claude = getAnthropic();
  if (!claude) {
    // No AI configured — fall back to raw external content if it's
    // long enough to be useful, else give up.
    if (externalDesc && externalDesc.trim().length >= 40) {
      return {
        tasting_notes: clip(externalDesc.trim(), MAX_CHARS),
        summary_for_customer: null,
        generated: false,
      };
    }
    return { tasting_notes: null, summary_for_customer: null, generated: false };
  }

  // Two code paths depending on whether we have rich source material:
  //
  // - DISTILL: we scraped real tasting content (ReserveBar's "TASTING
  //   NOTES" block, a producer site's product description, OFF's
  //   generic_name + ingredients). Haiku rewrites it into Gabby's
  //   structured two-field format, preserving the producer's own
  //   flavor notes instead of hallucinating new ones. This is the
  //   highest-quality outcome — real source material, Gabby's voice.
  //
  // - GENERATE: no external content found. Haiku writes notes grounded
  //   only on brand + varietal + category. Still good when varietal is
  //   populated, but strictly style-level — no producer-specific flavor
  //   claims.
  const hasExternal = !!externalDesc && externalDesc.trim().length >= 40;
  const prompt = hasExternal
    ? buildDistillPrompt(core, externalDesc!.trim())
    : buildPrompt(core);

  try {
    const res = await claude.messages.create({
      model: "claude-haiku-4-5",
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
      // "generated" is true only when we had to invent from scratch —
      // distilled-from-source output is higher confidence and is
      // surfaced with the original provider's source label by the
      // orchestrator.
      generated: !hasExternal,
    };
  } catch {
    // Last-ditch fallback to the raw external content so we at least
    // have *something* to show rather than a blank card.
    if (hasExternal) {
      return {
        tasting_notes: clip(externalDesc!.trim(), MAX_CHARS),
        summary_for_customer: null,
        generated: false,
      };
    }
    return { tasting_notes: null, summary_for_customer: null, generated: false };
  }
}

/**
 * Distill real source material (producer site / retailer tasting notes
 * section / OFF description) into Gabby's structured format. Do NOT
 * invent new flavors — faithfully summarize what's there.
 */
function buildDistillPrompt(core: ProductCore, source: string): string {
  const facts: string[] = [`Name: ${core.name}`];
  if (core.brand) facts.push(`Brand: ${core.brand}`);
  if (core.varietal) facts.push(`Varietal/Style: ${core.varietal}`);
  if (core.category) facts.push(`Category: ${core.category}`);

  return `You are rewriting product copy into a beverage AI assistant's voice (Gabby). Shoppers read these notes to decide what to buy and what to pair with dinner.

Product facts:
${facts.map((f) => `- ${f}`).join("\n")}

Source material (from the producer / retailer — may be marketing prose, tasting notes, or both):
"""
${source.slice(0, 1500)}
"""

Your job: rewrite the source into Gabby's structured JSON. Preserve flavor descriptors, aging/production notes, and recommended pairings FROM THE SOURCE. Do not invent new flavors, regions, or awards that aren't in the source.

Return JSON with exactly these keys:
{
  "tasting_notes": "≤180 characters. Flavor + structure + finish. Example: 'Almonds, vanilla, and light fruit on the nose. Smooth and creamy palate with a dry, clean finish.'",
  "summary_for_customer": "≤240 characters. One friendly sentence Gabby would say, including a pairing or occasion suggestion FROM THE SOURCE if one is mentioned. Example: 'A classic light rum — perfect for mojitos, daiquiris, and anytime you want a smooth cocktail base.'"
}

RULES:
- Drop any promotional / shipping / sale language from the source.
- If the source is short or generic, return null for any field you can't fill with confidence.
- No markdown fences, no prose outside the JSON.`;
}

function buildPrompt(core: ProductCore): string {
  // We present the facts as a labeled list so Haiku can ground on each
  // field independently. Varietal is the single biggest signal for
  // tasting-note quality — it's what turns "CAPT MORGAN SPICED RUM" from
  // a guess into a confident style description.
  const facts: string[] = [`Name: ${core.name}`];
  if (core.brand) facts.push(`Brand: ${core.brand}`);
  if (core.varietal) facts.push(`Varietal/Style: ${core.varietal}`);
  if (core.category) facts.push(`Category: ${core.category}`);
  if (core.size_label) facts.push(`Size: ${core.size_label}`);

  return `You are a beverage expert writing for a store's AI shopping assistant (Gabby). Shoppers read these notes to decide what to buy and what to pair with dinner, so be specific and useful.

Write tasting notes grounded in the well-known characteristics of the VARIETAL/STYLE. Do NOT invent vintages, awards, regions, producer anecdotes, or proof statements that aren't in the facts below.

Product facts:
${facts.map((f) => `- ${f}`).join("\n")}

Return JSON with exactly these keys:
{
  "tasting_notes": "≤180 characters. Flavor + structure + finish, in that order. Example: 'Vanilla, caramel, and baking spice lead into a warm, slightly sweet finish. Smooth and easy to mix.'",
  "summary_for_customer": "≤240 characters. One friendly sentence Gabby would say, including a FOOD OR OCCASION pairing suggestion. Example: 'Great in a classic rum and Coke, or pour it over ice with a splash of ginger beer on a warm afternoon.'"
}

RULES:
- If varietal is given, use it confidently. If not, infer cautiously from the name; never invent specific regions or awards.
- Pairings must be generic to the style (a Cabernet with steak, an IPA with spicy food, a Tequila Reposado with tacos) — not tied to a specific producer.
- If you truly cannot write a field with confidence, return null for that field.

Output ONLY the JSON, no prose, no markdown fences.`;
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
