// Claude AI client for Megan Assistant + custom module generation.
// Uses Claude Sonnet for reasoning (Assistant queries, module generation).

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

/**
 * Ask Megan a question about beverages, using the store's inventory as context.
 * Returns a natural-language answer grounded in what the store actually carries.
 */
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
  const claude = getAnthropic();
  if (!claude) {
    return "AI is not configured. Add ANTHROPIC_API_KEY to enable Megan's conversational assistant.";
  }

  const inventoryContext =
    opts.inventory.length > 0
      ? opts.inventory
          .map(
            (i) =>
              `- ${i.name}${i.brand ? ` (${i.brand})` : ""}${i.category ? ` [${i.category}]` : ""} — ${i.price != null ? `$${Number(i.price).toFixed(2)}` : "price N/A"} — ${i.stock_qty} in stock`,
          )
          .join("\n")
      : "No matching inventory items found.";

  const message = await claude.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    system: `You are Megan, the AI beverage assistant at ${opts.storeName}. You help store staff answer customer questions about wine, spirits, beer, and cocktails.

RULES:
- Be concise (2-4 sentences for simple questions, up to a paragraph for complex ones)
- Always reference specific products FROM THE STORE'S INVENTORY when possible
- Include prices when available
- If the store doesn't carry what the customer wants, suggest the closest alternative from inventory
- Speak like a knowledgeable friend, not a textbook
- If asked about food pairings, be specific and confident
- Never say "I don't know" — always offer a helpful suggestion even if the exact product isn't in stock`,
    messages: [
      {
        role: "user",
        content: `Store inventory matching this query:\n${inventoryContext}\n\nCustomer question: "${opts.query}"`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock?.text ?? "I couldn't generate a response. Please try again.";
}

/**
 * Generate a training module from uploaded document text.
 * Returns structured content ready to insert into the modules table.
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
    model: "claude-sonnet-4-20250514",
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
    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = textBlock.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    return JSON.parse(jsonStr.trim());
  } catch {
    return null;
  }
}
