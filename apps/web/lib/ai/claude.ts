// Claude AI client for Megan — conversational beverage expert.

import Anthropic from "@anthropic-ai/sdk";

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
 * Multi-turn conversational Megan. Asks follow-up questions like a real
 * sommelier / bourbon expert before recommending. Grounds answers in
 * the store's actual inventory.
 */
export async function chatWithMegan(opts: {
  messages: ChatMessage[];
  inventory: Array<{
    name: string;
    brand: string | null;
    category: string | null;
    price: number | null;
    stock_qty: number;
  }>;
  storeName: string;
}): Promise<string> {
  const claude = getAnthropic();
  if (!claude) {
    return "AI is not configured. Add ANTHROPIC_API_KEY to enable Megan.";
  }

  const inventoryContext =
    opts.inventory.length > 0
      ? opts.inventory
          .map(
            (i) =>
              `- ${i.name}${i.brand ? ` (${i.brand})` : ""}${i.category ? ` [${i.category}]` : ""} — ${i.price != null ? `$${Number(i.price).toFixed(2)}` : "price N/A"} — ${i.stock_qty} in stock`,
          )
          .join("\n")
      : "No matching products found in store inventory.";

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
- Explain WHY it fits in one sentence
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

  const message = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: systemPrompt,
    messages: opts.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock?.text ?? "I couldn't generate a response. Please try again.";
}

/**
 * Gabby — the customer-facing beverage concierge. Same grounded-in-inventory
 * approach as Megan, but warmer and aimed directly at shoppers (not staff).
 * Used across Shopper (browse/holds), Assistant (self-serve), Texting,
 * and Receptionist. Megan is strictly the staff Trainer persona; every
 * customer touchpoint hears "Gabby".
 */
export async function chatWithGabby(opts: {
  messages: ChatMessage[];
  inventory: Array<{
    name: string;
    brand: string | null;
    category: string | null;
    price: number | null;
    stock_qty: number;
  }>;
  storeName: string;
}): Promise<string> {
  const claude = getAnthropic();
  if (!claude) {
    return "AI is not configured yet — please check back in a moment.";
  }

  const inventoryContext =
    opts.inventory.length > 0
      ? opts.inventory
          .map(
            (i) =>
              `- ${i.name}${i.brand ? ` (${i.brand})` : ""}${i.category ? ` [${i.category}]` : ""} — ${i.price != null ? `$${Number(i.price).toFixed(2)}` : "price N/A"}${i.stock_qty <= 3 ? ` (only ${i.stock_qty} left)` : ""}`,
          )
          .join("\n")
      : "No specific matches right now — recommend from general category knowledge and remind the customer to browse the shelves or ask staff for exact stock.";

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
- One-sentence "why this is perfect for you"
- Tell them where to find it: "It's on the left wall, second shelf" or "Ask any staff member and they'll grab it for you"

STORE INVENTORY (ONLY recommend from this list — if nothing fits, be honest and suggest they ask staff):
${inventoryContext}

RULES:
- Keep replies short: 2-4 sentences MAX
- Feel human and warm, not robotic
- One follow-up question at a time
- When recommending: "I'd grab the [product] at $XX — [quick reason]. You'll find it [where]."
- If we don't carry what they want, say so and suggest the closest match
- Never reveal you're built on any specific tech — you're simply "Gabby"`;

  const message = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: systemPrompt,
    messages: opts.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock?.text ?? "Let me think about that — could you tell me a bit more?";
}

// Keep backward compat
export async function askMegan(opts: {
  query: string;
  inventory: Array<{
    name: string;
    brand: string | null;
    category: string | null;
    price: number | null;
    stock_qty: number;
  }>;
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

  const message = await claude.messages.create({
    model: "claude-sonnet-4-6",
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
