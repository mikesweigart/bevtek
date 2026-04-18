// Debug endpoint for the name-normalization pass.
//
// Visit /api/debug/normalize in a browser (while signed in as owner)
// to see exactly what Claude Haiku returns for a small test batch,
// whether the JSON parses, and which fields come back populated.
// Use this to diagnose "Step 1 isn't doing anything" reports without
// redeploying or crawling Vercel function logs.
//
// Owner-only; returns a clean 403 otherwise.

import { NextResponse } from "next/server";
import { getAnthropic, isAIConfigured } from "@/lib/ai/claude";
import { createClient } from "@/utils/supabase/server";
import {
  normalizeNamesBatch,
  type NormalizeInput,
} from "@/lib/enrichment/normalizeNames";

export const runtime = "nodejs";

const SAMPLE_INPUTS: NormalizeInput[] = [
  {
    id: "sample-1",
    name: "SUTTER HOME PINOT GRIGIO 1.5 L",
    category: "wine",
  },
  {
    id: "sample-2",
    name: "JIM BEAM HONEY 750ml",
    category: "spirits",
  },
  {
    id: "sample-3",
    name: "BACARDI SUPERIOR RUM 750ml",
    category: "spirits",
  },
];

export async function GET() {
  // Auth gate — only owners/managers can run this. Debug endpoints
  // should never be anon-accessible even when they're read-only.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "owner" && role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Env health check first — this is by far the most common cause of
  // "normalization isn't writing anything."
  const env = {
    anthropic_key_configured: isAIConfigured(),
  };
  if (!env.anthropic_key_configured) {
    return NextResponse.json({
      ok: false,
      reason: "ANTHROPIC_API_KEY is not set on this deployment.",
      env,
    });
  }

  // Call Haiku through the real normalization path with a tiny fixed
  // batch so the output is deterministic and easy to compare against.
  const parsed = await normalizeNamesBatch(SAMPLE_INPUTS);

  // Also call Haiku raw so we can see exactly what it returned — if
  // parsing failed in normalizeNamesBatch we want to know why.
  const claude = getAnthropic();
  let rawHaikuText: string | null = null;
  let rawHaikuError: string | null = null;
  try {
    const res = await claude!.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: `Return ONLY this JSON array (no prose, no code fences):
[
  {"id": "test-1", "brand": "Sutter Home", "varietal": "Pinot Grigio", "size_label": "1.5L"}
]`,
        },
      ],
    });
    const block = res.content.find((b) => b.type === "text");
    rawHaikuText = block && block.type === "text" ? block.text : null;
  } catch (e) {
    rawHaikuError = (e as Error).message;
  }

  return NextResponse.json({
    ok: parsed.some((r) => r.brand),
    env,
    parsed_results: parsed,
    raw_haiku_test: {
      text: rawHaikuText,
      error: rawHaikuError,
    },
    sample_inputs: SAMPLE_INPUTS,
  });
}
