// Fetches the Retell Conversation Flow definition and prints
// a structured summary of its nodes, transitions, and tools.
// This is how we figure out which backend tool endpoints to build
// for /api/retell/tools/* — one endpoint per function node in the flow.
//
// Reads RETELL_API_KEY + RETELL_DEFAULT_FLOW_ID from apps/web/.env.local
// directly (dotenv-free, no deps).
//
// Usage (from repo root):
//   pnpm tsx scripts/get-retell-flow.ts
//
// Also writes the full raw JSON to scripts/.retell-flow-dump.json
// so we can grep/diff it later without re-hitting the API.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(name: string): string | null {
  const path = resolve(process.cwd(), "apps/web/.env.local");
  const text = readFileSync(path, "utf8");
  const line = text.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  if (!line) return null;
  return line.slice(`${name}=`.length).trim().replace(/^['"]|['"]$/g, "");
}

// Retell node shapes vary by version. We use broad optional fields and
// pattern-match what we see. Anything unexpected lands in the raw dump.
type FlowNode = {
  id?: string;
  node_id?: string;
  name?: string;
  type?: string;
  instruction?: string | { type?: string; text?: string };
  prompt?: string;
  tool?: { name?: string; description?: string; url?: string; type?: string };
  tools?: Array<{ name?: string; description?: string; url?: string; type?: string }>;
  edges?: Array<{ destination_node_id?: string; transition_condition?: unknown }>;
  [k: string]: unknown;
};

type Flow = {
  conversation_flow_id?: string;
  version?: number;
  global_prompt?: string;
  start_node_id?: string;
  nodes?: FlowNode[];
  tools?: Array<{ name?: string; description?: string; url?: string; type?: string }>;
  [k: string]: unknown;
};

async function main() {
  const key = loadEnv("RETELL_API_KEY");
  const flowId = loadEnv("RETELL_DEFAULT_FLOW_ID");

  if (!key || !flowId) {
    console.error("✗ Missing RETELL_API_KEY or RETELL_DEFAULT_FLOW_ID in apps/web/.env.local");
    process.exit(1);
  }

  console.log(`Fetching flow: ${flowId}\n`);

  const res = await fetch(
    `https://api.retellai.com/get-conversation-flow/${flowId}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );

  const body = await res.text();

  if (res.status !== 200) {
    console.error(`✗ Retell API error (HTTP ${res.status}):`);
    console.error(body.slice(0, 500));
    process.exit(1);
  }

  const flow = JSON.parse(body) as Flow;

  // Save raw for later inspection.
  const dumpPath = resolve(process.cwd(), "scripts/.retell-flow-dump.json");
  writeFileSync(dumpPath, JSON.stringify(flow, null, 2), "utf8");
  console.log(`Raw JSON saved → ${dumpPath}\n`);

  // ---------- Summary ----------
  console.log("=== Flow metadata ===");
  console.log(`  conversation_flow_id:  ${flow.conversation_flow_id ?? "(none)"}`);
  console.log(`  version:               ${flow.version ?? "(none)"}`);
  console.log(`  start_node_id:         ${flow.start_node_id ?? "(none)"}`);
  console.log(`  global_prompt length:  ${flow.global_prompt?.length ?? 0} chars`);
  console.log();

  // ---------- Top-level tools (flow-wide, shared across nodes) ----------
  if (flow.tools && flow.tools.length > 0) {
    console.log(`=== Flow-level tools (${flow.tools.length}) ===`);
    for (const t of flow.tools) {
      console.log(`  • ${t.name ?? "(unnamed)"}  [${t.type ?? "?"}]`);
      if (t.url) console.log(`      url:  ${t.url}`);
      if (t.description) console.log(`      desc: ${t.description.slice(0, 120)}`);
    }
    console.log();
  } else {
    console.log("=== Flow-level tools: none ===\n");
  }

  // ---------- Nodes ----------
  const nodes = flow.nodes ?? [];
  console.log(`=== Nodes (${nodes.length}) ===`);
  if (nodes.length === 0) {
    console.log("  (no nodes found — flow may still be in draft)\n");
  } else {
    for (const n of nodes) {
      const id = n.node_id ?? n.id ?? "(no-id)";
      const name = n.name ?? "";
      const type = n.type ?? "unknown";
      console.log(`  • [${type}] ${id}  ${name ? `"${name}"` : ""}`);

      // Function / tool calls at the node level
      if (n.tool) {
        console.log(`      tool: ${n.tool.name ?? "(unnamed)"} [${n.tool.type ?? "?"}]`);
        if (n.tool.url) console.log(`      url:  ${n.tool.url}`);
      }
      if (n.tools && n.tools.length > 0) {
        for (const t of n.tools) {
          console.log(`      tool: ${t.name ?? "(unnamed)"} [${t.type ?? "?"}]`);
          if (t.url) console.log(`      url:  ${t.url}`);
        }
      }

      // Prompt/instruction preview
      const inst = typeof n.instruction === "string"
        ? n.instruction
        : n.instruction?.text;
      const p = inst ?? n.prompt;
      if (p) {
        const preview = p.replace(/\s+/g, " ").slice(0, 90);
        console.log(`      prompt: "${preview}${p.length > 90 ? "…" : ""}"`);
      }

      // Edges
      if (n.edges && n.edges.length > 0) {
        const targets = n.edges.map((e) => e.destination_node_id ?? "?").join(", ");
        console.log(`      → ${n.edges.length} edge(s) to: ${targets}`);
      }
    }
    console.log();
  }

  // ---------- Hints for next step ----------
  const allTools = [
    ...(flow.tools ?? []),
    ...nodes.flatMap((n) => [
      ...(n.tool ? [n.tool] : []),
      ...(n.tools ?? []),
    ]),
  ];
  const customTools = allTools.filter(
    (t) => t.type === "custom" || (t.url && !t.url.startsWith("https://api.retellai.com")),
  );

  console.log("=== Custom backend tools the flow expects ===");
  if (customTools.length === 0) {
    console.log("  (none — flow currently has no external backend calls wired up)");
    console.log("  → We'll need to ADD function nodes pointing to our /api/retell/tools/* endpoints.");
  } else {
    for (const t of customTools) {
      console.log(`  • ${t.name ?? "(unnamed)"}  →  ${t.url ?? "(no url)"}`);
    }
    console.log("  → We'll need to BUILD these endpoints on the web app.");
  }
  console.log();

  console.log("=== Done ===");
  console.log(`Full flow JSON: scripts/.retell-flow-dump.json`);
}

main().catch((e) => {
  console.error("✗ Unexpected error:", e);
  process.exit(1);
});
