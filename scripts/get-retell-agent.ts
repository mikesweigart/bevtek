// Fetches the current Retell agent config and prints the fields
// we care about: voice, LLM type, and whatever prompt/URL it points
// to. Lets us answer the A/B/C config question without hunting
// through the Retell dashboard UI.
//
// Reads RETELL_API_KEY + RETELL_DEFAULT_AGENT_ID from apps/web/.env.local
// directly (dotenv-free, no deps).
//
// Usage (from repo root):
//   pnpm tsx scripts/get-retell-agent.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(name: string): string | null {
  const path = resolve(process.cwd(), "apps/web/.env.local");
  const text = readFileSync(path, "utf8");
  const line = text.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  if (!line) return null;
  return line.slice(`${name}=`.length).trim().replace(/^['"]|['"]$/g, "");
}

async function main() {
  const key = loadEnv("RETELL_API_KEY");
  const agentId = loadEnv("RETELL_DEFAULT_AGENT_ID");

  if (!key || !agentId) {
    console.error("✗ Missing RETELL_API_KEY or RETELL_DEFAULT_AGENT_ID in apps/web/.env.local");
    process.exit(1);
  }

  console.log(`Fetching agent: ${agentId}\n`);

  const res = await fetch(`https://api.retellai.com/get-agent/${agentId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });

  const body = await res.text();

  if (res.status !== 200) {
    console.error(`✗ Retell API error (HTTP ${res.status}):`);
    console.error(body.slice(0, 500));
    process.exit(1);
  }

  type Agent = {
    agent_id?: string;
    agent_name?: string;
    voice_id?: string;
    voice_model?: string;
    language?: string;
    response_engine?: { type?: string; llm_id?: string; conversation_flow_id?: string };
    llm_websocket_url?: string;
    webhook_url?: string;
    [k: string]: unknown;
  };

  const agent = JSON.parse(body) as Agent;

  console.log("=== Agent config ===");
  console.log(`  agent_id:        ${agent.agent_id ?? "(none)"}`);
  console.log(`  agent_name:      ${agent.agent_name ?? "(none)"}`);
  console.log(`  voice_id:        ${agent.voice_id ?? "(none)"}`);
  console.log(`  voice_model:     ${agent.voice_model ?? "(none)"}`);
  console.log(`  language:        ${agent.language ?? "(none)"}`);
  console.log(`  webhook_url:     ${agent.webhook_url ?? "(none — no status callbacks)"}`);
  console.log();

  console.log("=== LLM / response engine ===");
  const eng = agent.response_engine;
  if (!eng) {
    console.log("  (no response_engine object — older agent shape?)");
  } else {
    console.log(`  type:            ${eng.type ?? "(none)"}`);
    if (eng.type === "retell-llm") {
      console.log(`  llm_id:          ${eng.llm_id ?? "(none)"}`);
      console.log("  → Answer: (A) Retell's built-in LLM. We paste Gabby's prompt into the dashboard.");
    } else if (eng.type === "custom-llm") {
      console.log(`  llm_websocket_url: ${agent.llm_websocket_url ?? "(none)"}`);
      console.log("  → Answer: (B) Custom LLM URL. We need /api/retell/llm live and pointed here.");
    } else if (eng.type === "conversation-flow") {
      console.log(`  conversation_flow_id: ${eng.conversation_flow_id ?? "(none)"}`);
      console.log("  → Answer: Conversation Flow (Retell's visual builder).");
    } else {
      console.log(`  → Unknown engine type: ${eng.type}`);
    }
  }
  console.log();

  console.log("=== Full raw response (for debugging) ===");
  console.log(JSON.stringify(agent, null, 2).slice(0, 3000));
}

main().catch((e) => {
  console.error("✗ Unexpected error:", e);
  process.exit(1);
});
