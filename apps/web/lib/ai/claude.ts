// Claude AI client for Megan — conversational beverage expert.

import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Prompt versioning.
//
// Every prompt change bumps the matching version string. These get logged on
// every Claude call (see logClaudeCall below) so we can correlate quality
// drops / cost spikes / hallucination rates back to a specific revision.
//
// Rule: if you change the prompt body, bump the patch. If you change the
// structure of what gets passed in (new context block, new rules section),
// bump the minor. Never re-use a version number.
// ---------------------------------------------------------------------------
export const PROMPT_VERSIONS = {
  megan: "megan@1.0.0",
  gabby: "gabby@1.1.0", // v1.1 added [FEATURED]/[SPONSORED] + responsibility rules
  moduleGen: "module-gen@1.0.0",
} as const;

export const CLAUDE_MODEL = "claude-sonnet-4-6";

export type ClaudeCallLog = {
  feature: "megan" | "gabby" | "module-gen";
  prompt_version: string;
  model: string;
  store_id?: string | null;
  store_name?: string | null;
  input_message_count: number;
  inventory_count: number;
  featured_count?: number;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  ok: boolean;
  error_class?: string | null;
};

// Pluggable sink. Default writes a one-line structured log to stdout so
// Vercel captures it; prod can override with an Axiom/Sentry transport.
let claudeCallSink: (entry: ClaudeCallLog) => void = (entry) => {
  // eslint-disable-next-line no-console
  console.log("[claude.call]", JSON.stringify(entry));
};

export function setClaudeCallSink(fn: (entry: ClaudeCallLog) => void) {
  claudeCallSink = fn;
}

function logClaudeCall(entry: ClaudeCallLog) {
  try {
    claudeCallSink(entry);
  } catch {
    // Never let telemetry break the user-facing path.
  }
}

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (cached) return cached;
  cached = new Anthropic({ apiKey: key });
  return cached;
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Shape passed into chatWithMegan/chatWithGabby. Every field beyond
 * `name` is optional and nullable because our enrichment pipeline fills
 * these in progressively — Gabby must still do her best with whatever
 * the row has. When varietal + tasting_notes are present she can give
 * a specific, grounded recommendation; when they're missing she falls
 * back to style-level advice.
 */
export type InventoryForAI = {
  name: string;
  brand: string | null;
  varietal?: string | null;
  category: string | null;
  price: number | null;
  stock_qty: number;
  tasting_notes?: string | null;
  summary_for_customer?: string | null;
  /** Community review data from Vivino/Untappd/Distiller (Pass 3). */
  review_score?: number | null;
  review_count?: number | null;
  review_source?: string | null;
};

/**
 * Build the human-readable inventory block the system prompt injects.
 * Format is compact but rich: one line per product, with flavor notes
 * indented when present. The model treats the block as hard-ground:
 * "ONLY recommend from this list."
 */
function formatInventoryBlock(inventory: InventoryForAI[]): string {
  if (inventory.length === 0) {
    return "No matching products found in store inventory.";
  }
  return inventory
    .map((i) => {
      const parts = [i.name];
      if (i.brand) parts.push(`(${i.brand})`);
      if (i.varietal) parts.push(`— ${i.varietal}`);
      if (i.category) parts.push(`[${i.category}]`);
      const price = i.price != null ? `$${Number(i.price).toFixed(2)}` : "price N/A";
      const stock =
        i.stock_qty <= 3 ? `only ${i.stock_qty} left` : `${i.stock_qty} in stock`;
      let line = `- ${parts.join(" ")} — ${price} — ${stock}`;
      // Community review score — citeable trust signal. We only include
      // it when reviews are populated; sources we scrape (vivino/untappd/
      // distiller) are all named so Gabby can attribute correctly.
      if (
        i.review_score != null &&
        i.review_count != null &&
        i.review_source
      ) {
        line += ` — ★${i.review_score.toFixed(1)} (${i.review_count.toLocaleString()} on ${i.review_source})`;
      }
      // Flavor / pairing notes — the single biggest lever for Gabby
      // giving specific recommendations instead of generic ones.
      const notes = i.summary_for_customer ?? i.tasting_notes;
      if (notes) line += `\n    · ${notes}`;
      return line;
    })
    .join("\n");
}

/**
 * Multi-turn conversational Megan. Asks follow-up questions like a real
 * sommelier / bourbon expert before recommending. Grounds answers in
 * the store's actual inventory.
 */
export async function chatWithMegan(opts: {
  messages: ChatMessage[];
  inventory: InventoryForAI[];
  storeName: string;
  storeId?: string | null;
}): Promise<string> {
  const claude = getAnthropic();
  if (!claude) {
    return "AI is not configured. Add ANTHROPIC_API_KEY to enable Megan.";
  }

  const inventoryContext = formatInventoryBlock(opts.inventory);

  const systemPrompt = `You are Megan, the AI beverage expert at ${opts.storeName}. You help store staff answer customer questions — and you're REALLY good at it.

PERSONALITY:
- Warm, friendly, genuinely passionate about beverages
- Confident but never condescending — like the best sommelier you've ever met
- You love helping people discover the right drink
- Empathetic — you read between the lines of what customers actually need

CONVERSATION STYLE — THIS IS CRITICAL:
When a question is BROAD or OPEN ("what wine for chicken?", "recommend a bourbon", "I need a gift"), you MUST ask 1-2 SHORT follow-up questions before recommending. A real expert narrows it down first:

Examples of good follow-ups:
- "Love it! Quick question — are you thinking white or red with that?"
- "Sure thing! What's your budget — everyday range or something special?"
- "Great choice! Do you prefer smooth and easy-sipping, or bold with some kick?"
- "Absolutely! Is this for drinking neat, on the rocks, or mixing cocktails?"
- "Nice! Full-proof and bold, or something lighter and smoother?"
- "Who's it for? That'll help me pick the perfect one."

When a question is SPECIFIC ENOUGH ("peaty Scotch under $60", "Pinot Noir for salmon"), go straight to a confident recommendation.

AFTER getting enough context (usually after 1-2 follow-ups), give a SPECIFIC recommendation:
- Name 1-2 products FROM THE STORE INVENTORY below
- Include the price
- Explain WHY it fits in one sentence — if the product has tasting notes or a customer summary (the indented "·" line under it), USE those exact flavor descriptors and pairing cues instead of generic style advice. They're pulled from real producer copy.
- Cite the community review score when present (the "★4.3 (1,843 on vivino)" bit). Real shoppers' ratings are a stronger trust signal than expert copy — "this one's 4.3 stars on Vivino with 1,800+ reviews" beats generic pitch talk.
- Be decisive — "I'd go with..." not "you could try..."

WHAT YOU KNOW:
- Wine: regions, grapes, food pairings, vintages, serving temps, glassware
- Bourbon: mash bills (high-rye vs wheated), proof preferences, cocktail vs sipping
- Scotch: peated vs unpeated, regions, age statements
- Tequila: blanco vs reposado vs añejo, 100% agave importance
- Beer: IPA styles (West Coast vs Hazy), craft recommendations, food pairings
- Cocktails: recipes, ingredients, techniques, proportions
- Gifts: budget-appropriate, presentation matters
- Food pairings: be specific and confident

STORE INVENTORY (what we actually carry — ONLY recommend from this list):
${inventoryContext}

RULES:
- Keep each response to 2-4 sentences MAX
- Sound human, warm, conversational — NOT like a search engine
- Ask ONE follow-up question at a time (not three at once)
- When recommending, be decisive: "I'd go with the [product] at $XX"
- If we don't carry what they want, say so honestly and suggest the closest thing we DO have`;

  const startedAt = Date.now();
  let ok = false;
  let errorClass: string | null = null;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  try {
    const message = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: opts.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });
    inputTokens = message.usage?.input_tokens ?? null;
    outputTokens = message.usage?.output_tokens ?? null;
    ok = true;
    const textBlock = message.content.find((b) => b.type === "text");
    return textBlock?.text ?? "I couldn't generate a response. Please try again.";
  } catch (e) {
    errorClass = (e as Error)?.name ?? "UnknownError";
    throw e;
  } finally {
    logClaudeCall({
      feature: "megan",
      prompt_version: PROMPT_VERSIONS.megan,
      model: CLAUDE_MODEL,
      store_id: opts.storeId ?? null,
      store_name: opts.storeName,
      input_message_count: opts.messages.length,
      inventory_count: opts.inventory.length,
      latency_ms: Date.now() - startedAt,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      ok,
      error_class: errorClass,
    });
  }
}

/**
 * Gabby — the customer-facing beverage concierge. Same grounded-in-inventory
 * approach as Megan, but warmer and aimed directly at shoppers (not staff).
 * Used across Shopper (browse/holds), Assistant (self-serve), Texting,
 * and Receptionist. Megan is strictly the staff Trainer persona; every
 * customer touchpoint hears "Gabby".
 */
/**
 * A product that's been featured (store-chosen) or sponsored (national
 * promo). Passed separately from regular inventory so Gabby can boost it
 * when it fits the customer's request — and disclose sponsorship when
 * the promo is national-kind, per FTC guidance.
 */
export type FeaturedForAI = {
  name: string;
  brand: string | null;
  varietal: string | null;
  price: number | null;
  stock_qty: number;
  tagline: string | null;
  summary: string | null;
  kind: "store" | "national";
};

function formatFeaturedBlock(featured: FeaturedForAI[]): string {
  if (featured.length === 0) return "";
  const lines = featured
    .map((f) => {
      const parts = [f.name];
      if (f.brand) parts.push(`(${f.brand})`);
      if (f.varietal) parts.push(`— ${f.varietal}`);
      const price = f.price != null ? `$${Number(f.price).toFixed(2)}` : "price N/A";
      const label = f.kind === "national" ? "[SPONSORED]" : "[FEATURED]";
      let line = `- ${label} ${parts.join(" ")} — ${price}`;
      const note = f.tagline ?? f.summary;
      if (note) line += `\n    · ${note}`;
      return line;
    })
    .join("\n");
  return lines;
}

export async function chatWithGabby(opts: {
  messages: ChatMessage[];
  inventory: InventoryForAI[];
  featured?: FeaturedForAI[];
  storeName: string;
  storeId?: string | null;
}): Promise<string> {
  const claude = getAnthropic();
  if (!claude) {
    return "AI is not configured yet — please check back in a moment.";
  }

  const inventoryContext =
    opts.inventory.length > 0
      ? formatInventoryBlock(opts.inventory)
      : "No specific matches right now — recommend from general category knowledge and remind the customer to browse the shelves or ask staff for exact stock.";

  // Featured/sponsored boost. When the customer's request reasonably fits
  // one of these, Gabby mentions it first. For [SPONSORED] items she
  // naturally discloses ("one of our featured partner picks this month")
  // so the audio-only surfaces are FTC-honest even without a visible badge.
  const featured = opts.featured ?? [];
  const featuredBlock = formatFeaturedBlock(featured);
  const featuredSection = featuredBlock
    ? `\n\nFEATURED & SPONSORED PICKS THIS MONTH:
${featuredBlock}

FEATURED-BOOST RULES:
- When a customer's request genuinely fits one of the items above, mention it FIRST before other inventory matches.
- Never force a featured item into a conversation it doesn't fit — honesty beats a boost. If nothing on the featured list suits them, recommend from regular inventory.
- For items marked [SPONSORED] (national partner promos), disclose naturally in the same sentence — e.g. "one of our featured partner picks this month" or "a sponsored pick from our supplier". This is non-negotiable; the customer must know it's a paid placement.
- For items marked [FEATURED] (the store's own pick), no disclosure needed — just say "one of our featured bottles" or "a staff favorite this month".`
    : "";

  const systemPrompt = `You are Gabby, the AI beverage concierge at ${opts.storeName}. You're talking DIRECTLY to a customer (not store staff). Be warm, welcoming, and genuinely excited to help them find exactly what they want.

PERSONALITY:
- Friendly and approachable, like the best bartender or shop owner you've ever met
- Confident in your recommendations — customers come to you because you know
- Never condescending — meet people where they are
- Enthusiastic about beverages without being pretentious

CONVERSATION APPROACH:
For BROAD requests ("recommend a wine", "I need a gift", "what pairs with chicken"), ask ONE quick follow-up to narrow it down:
- "What's the occasion?" or "Who's it for?"
- "Budget range — everyday or something special?"
- "Red, white, or surprise me?"
- "Sipping it neat, on the rocks, or mixing?"

For SPECIFIC requests ("Pinot Noir under $30", "peaty Scotch"), go straight to recommendations.

WHEN RECOMMENDING:
- Pick 1-2 specific products FROM OUR STOCK below
- Include the price
- One-sentence "why this is perfect for you" — if the product has tasting notes or a customer summary (the indented "·" line under it), lean on those real flavor descriptors and pairing cues; they come from the producer/retailer, not from your imagination.
- When a product shows a community score (the "★4.3 (1,843 on vivino)" bit), mention it casually — "shoppers on Vivino give it 4.3 stars" — it's a trust cue customers respond to.
- Tell them where to find it: "It's on the left wall, second shelf" or "Ask any staff member and they'll grab it for you"

STORE INVENTORY (ONLY recommend from this list — if nothing fits, be honest and suggest they ask staff):
${inventoryContext}${featuredSection}

RULES:
- Keep replies short: 2-4 sentences MAX
- Feel human and warm, not robotic
- One follow-up question at a time
- When recommending: "I'd grab the [product] at $XX - [quick reason]. You'll find it [where]."
- If we don't carry what they want, say so and suggest the closest match
- Never reveal you're built on any specific tech — you're simply "Gabby"

FORMATTING (VERY IMPORTANT — your replies are read aloud by a text-to-speech voice):
- Write in plain conversational language, like you're speaking out loud
- NO markdown. NO asterisks for bold. NO underscores for italics. NO backticks.
- NO em-dashes (—) or en-dashes (–). Use regular hyphens or commas instead.
- NO bullet points or numbered lists. Use short natural sentences.
- NO headings. Don't label sections.
- NEVER emit the literal tokens "[SPONSORED]" or "[FEATURED]" in your reply — those are internal labels. When the item is sponsored, disclose it in natural words (see FEATURED-BOOST RULES).
- Just warm, flowing sentences a human would say out loud

RESPONSIBILITY:
- When you actually recommend a specific bottle, close with a light, human responsibility cue — "enjoy it responsibly" or "sip it slow, and have fun" — just once, in a natural tone. Never preachy, never on every reply. On casual small-talk turns where no recommendation is made, skip it entirely.`;

  const startedAt = Date.now();
  let ok = false;
  let errorClass: string | null = null;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let raw = "";
  try {
    const message = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      system: systemPrompt,
      messages: opts.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });
    inputTokens = message.usage?.input_tokens ?? null;
    outputTokens = message.usage?.output_tokens ?? null;
    ok = true;
    const textBlock = message.content.find((b) => b.type === "text");
    raw = textBlock?.text ?? "Let me think about that, could you tell me a bit more?";
  } catch (e) {
    errorClass = (e as Error)?.name ?? "UnknownError";
    throw e;
  } finally {
    // Hallucination gate: flag (don't throw) if Gabby mentions a product
    // that isn't in the context we handed her. Gets surfaced in the log so
    // you can see drift per prompt version without blocking user replies.
    const hallucinated = ok ? detectHallucinatedProducts(raw, opts.inventory, opts.featured ?? []) : [];
    logClaudeCall({
      feature: "gabby",
      prompt_version: PROMPT_VERSIONS.gabby,
      model: CLAUDE_MODEL,
      store_id: opts.storeId ?? null,
      store_name: opts.storeName,
      input_message_count: opts.messages.length,
      inventory_count: opts.inventory.length,
      featured_count: (opts.featured ?? []).length,
      latency_ms: Date.now() - startedAt,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      ok,
      error_class: errorClass,
    });
    if (hallucinated.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        "[gabby.hallucination]",
        JSON.stringify({
          prompt_version: PROMPT_VERSIONS.gabby,
          store_id: opts.storeId ?? null,
          suspected: hallucinated,
          excerpt: raw.slice(0, 200),
        }),
      );
    }
  }
  return stripMarkdownForVoice(raw);
}

/**
 * Heuristic check for product hallucination. Scans Gabby's reply for
 * capitalized noun phrases that look like product/brand names and flags
 * the ones that don't appear in the inventory or featured context she
 * was actually given.
 *
 * Deliberately low-precision: we'd rather over-flag in logs (which a
 * human or Claude-judge reviews) than block a legitimate reply. This is
 * an observability signal, not a filter.
 *
 * Common false positives we ignore: varietal/category names (Merlot,
 * Chardonnay), generic words (Wine, Bourbon), and anything shorter than
 * 4 chars.
 */
const PRODUCT_FALSE_POSITIVES = new Set([
  // Varietals / styles (generic, not product-specific)
  "merlot", "cabernet", "chardonnay", "pinot", "noir", "grigio", "sauvignon",
  "blanc", "riesling", "syrah", "shiraz", "malbec", "zinfandel", "bordeaux",
  "burgundy", "champagne", "prosecco", "cava", "rioja", "chianti", "barolo",
  "napa", "sonoma", "bourbon", "scotch", "whiskey", "whisky", "rye", "gin",
  "vodka", "tequila", "mezcal", "rum", "cognac", "brandy", "ipa", "lager",
  "pilsner", "stout", "porter", "hefeweizen", "witbier", "gose",
  // Generic nouns
  "wine", "beer", "spirits", "cocktail", "liqueur", "bottle", "glass",
  "store", "shelf", "staff", "gabby", "vivino", "untappd", "distiller",
  // Common words that capitalize at sentence start
  "the", "this", "that", "you", "your", "our", "let", "here", "there",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "june", "july", "august",
  "september", "october", "november", "december",
]);

export function detectHallucinatedProducts(
  reply: string,
  inventory: InventoryForAI[],
  featured: FeaturedForAI[],
): string[] {
  // Build a haystack of every token Gabby legitimately knows about:
  // product name words, brand words, varietals. Lowercase, 4+ chars.
  const haystack = new Set<string>();
  const addPhrase = (s: string | null | undefined) => {
    if (!s) return;
    for (const tok of s.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (tok.length >= 4) haystack.add(tok);
    }
  };
  for (const i of inventory) {
    addPhrase(i.name);
    addPhrase(i.brand);
    addPhrase(i.varietal);
  }
  for (const f of featured) {
    addPhrase(f.name);
    addPhrase(f.brand);
    addPhrase(f.varietal);
  }

  // Extract "product-shaped" phrases: runs of 1–4 Capitalized words.
  // E.g. "Caymus Cabernet", "Dom Pérignon", "Macallan 12".
  const phrases = reply.match(/\b([A-Z][\p{L}0-9'’&.-]+(?:\s+[A-Z][\p{L}0-9'’&.-]+){0,3})\b/gu) ?? [];
  const suspects: string[] = [];
  for (const phrase of phrases) {
    const norm = phrase.toLowerCase();
    const first = norm.split(/\s+/)[0];
    if (PRODUCT_FALSE_POSITIVES.has(first)) continue;
    if (norm.length < 4) continue;
    // If ANY token in the phrase is in the haystack, we treat the whole
    // phrase as grounded. Gabby often paraphrases — "Caymus Cab" should
    // pass if "caymus" is known.
    const tokens = norm.split(/\s+/).filter((t) => t.length >= 4);
    const grounded = tokens.some((t) => haystack.has(t));
    if (!grounded) suspects.push(phrase);
  }
  // Dedupe preserving order.
  return Array.from(new Set(suspects));
}

/**
 * Gabby's replies get read aloud by TTS, so we strip any markdown the model
 * leaked through despite the system-prompt rules. Also normalizes em/en
 * dashes to commas for more natural spoken cadence.
 */
function stripMarkdownForVoice(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")   // **bold**
    .replace(/\*(.+?)\*/g, "$1")        // *italic*
    .replace(/__(.+?)__/g, "$1")        // __bold__
    .replace(/_(.+?)_/g, "$1")          // _italic_
    .replace(/`(.+?)`/g, "$1")          // `code`
    .replace(/^#+\s+/gm, "")            // # headings
    .replace(/^\s*[-*+]\s+/gm, "")      // bullet list markers
    .replace(/\s*[—–]\s*/g, ", ")       // em/en dashes -> comma pause
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Keep backward compat
export async function askMegan(opts: {
  query: string;
  inventory: InventoryForAI[];
  storeName: string;
}): Promise<string> {
  return chatWithMegan({
    messages: [{ role: "user", content: opts.query }],
    inventory: opts.inventory,
    storeName: opts.storeName,
  });
}

/**
 * Generate a training module from uploaded document text.
 */
export async function generateModuleFromText(opts: {
  documentText: string;
  fileName: string;
}): Promise<{
  title: string;
  description: string;
  content: string;
  quiz: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
} | null> {
  const claude = getAnthropic();
  if (!claude) return null;

  const startedAt = Date.now();
  const message = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    system: `You are a master sommelier and beverage education expert. You create training modules for liquor store staff.

Given a document (product sheet, brand guide, etc.), generate:
1. A concise title (5-8 words)
2. A one-line description
3. Training content (250-400 words) following this structure:
   - THE STORY: brief history/background
   - KEY FACTS: what staff need to know
   - TOP SELLERS WITH PRICES: specific products and retail prices mentioned in the document
   - WHAT TO SAY ON THE FLOOR: 2-3 scripts for real customer conversations
4. Two quiz questions with 4 options each, correct answer index (0-3), and explanation

Respond in JSON format:
{
  "title": "...",
  "description": "...",
  "content": "...",
  "quiz": [
    {"question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "..."},
    {"question": "...", "options": ["A","B","C","D"], "correctIndex": 1, "explanation": "..."}
  ]
}`,
    messages: [
      {
        role: "user",
        content: `Generate a training module from this document (${opts.fileName}):\n\n${opts.documentText.slice(0, 8000)}`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  logClaudeCall({
    feature: "module-gen",
    prompt_version: PROMPT_VERSIONS.moduleGen,
    model: CLAUDE_MODEL,
    input_message_count: 1,
    inventory_count: 0,
    latency_ms: Date.now() - startedAt,
    input_tokens: message.usage?.input_tokens ?? null,
    output_tokens: message.usage?.output_tokens ?? null,
    ok: Boolean(textBlock?.text),
  });
  if (!textBlock?.text) return null;

  try {
    let jsonStr = textBlock.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    return JSON.parse(jsonStr.trim());
  } catch {
    return null;
  }
}
