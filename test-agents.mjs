#!/usr/bin/env node

// Test script for YouTube MCP Server — exercises the agent architecture
// Run: node test-agents.mjs
// With live YouTube: YOUTUBE_API_KEY=your-key node test-agents.mjs

import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { unlinkSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "dist", "index.js");
const testMemoryPath = join(__dirname, ".test-memory.json");

// Clean up previous test memory
try { unlinkSync(testMemoryPath); } catch {}

let requestId = 0;

function send(server, method, params) {
  requestId++;
  const hasId = !method.startsWith("notifications/");
  const msg = hasId
    ? JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params })
    : JSON.stringify({ jsonrpc: "2.0", method, params });
  server.stdin.write(msg + "\n");
  return hasId ? requestId : null;
}

async function runTest() {
  console.log("=== YouTube MCP Server — Agent Architecture Test ===\n");

  const server = spawn("node", [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, YOUTUBE_MCP_MEMORY_PATH: testMemoryPath },
  });

  let buffer = "";
  let resolveNext;

  function waitForResponse() {
    return new Promise((resolve) => {
      resolveNext = resolve;
      // Timeout after 15s
      setTimeout(() => { if (resolveNext) { resolveNext({ error: "timeout" }); resolveNext = null; } }, 15000);
    });
  }

  server.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line in buffer
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (resolveNext && parsed.id !== undefined) {
          const r = resolveNext;
          resolveNext = null;
          r(parsed);
        }
      } catch {}
    }
  });

  server.stderr.on("data", (chunk) => {
    const msg = chunk.toString().trim();
    if (msg) console.log(`  [server] ${msg}`);
  });

  // --- Step 1: Initialize ---
  console.log("1. Initializing MCP connection...");
  send(server, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" },
  });
  const initResp = await waitForResponse();
  console.log(`   Server: ${initResp.result?.serverInfo?.name} v${initResp.result?.serverInfo?.version}`);

  // Send initialized notification (no response expected)
  send(server, "notifications/initialized", {});
  await new Promise(r => setTimeout(r, 200));

  // --- Step 2: List tools ---
  console.log("\n2. Listing all tools...");
  send(server, "tools/list", {});
  const toolsResp = await waitForResponse();
  const tools = toolsResp.result?.tools || [];
  console.log(`   Found ${tools.length} tools:`);
  tools.forEach((t) => console.log(`   - ${t.name}`));

  // --- Step 3: Configure user profile ---
  console.log("\n3. Configuring user profile (USER component)...");
  send(server, "tools/call", {
    name: "configure_user",
    arguments: {
      industry: "SaaS",
      competitors: ["HubSpot", "Salesforce", "Pipedrive"],
      keywords: ["best CRM 2025", "sales automation tool", "CRM comparison"],
      notes: ["We sell a CRM for startups. Average deal size $500/mo."],
    },
  });
  const configResp = await waitForResponse();
  console.log(`   ${configResp.result?.content?.[0]?.text || JSON.stringify(configResp.error)}`);

  // --- Step 4: Add monitors ---
  console.log("\n4. Adding monitors...");
  send(server, "tools/call", {
    name: "add_monitor",
    arguments: { type: "keyword", value: "CRM review 2025" },
  });
  const mon1 = await waitForResponse();
  console.log(`   ${mon1.result?.content?.[0]?.text || JSON.stringify(mon1.error)}`);

  send(server, "tools/call", {
    name: "add_monitor",
    arguments: { type: "keyword", value: "best sales software" },
  });
  const mon2 = await waitForResponse();
  console.log(`   ${mon2.result?.content?.[0]?.text || JSON.stringify(mon2.error)}`);

  // --- Step 5: Get memory state ---
  console.log("\n5. Checking full memory state (MEMORY component)...");
  send(server, "tools/call", {
    name: "get_memory",
    arguments: {},
  });
  const memResp = await waitForResponse();
  console.log(`   ${memResp.result?.content?.[0]?.text || JSON.stringify(memResp.error)}`);

  // --- Step 6: Check heartbeat ---
  console.log("\n6. Heartbeat status (HEARTBEAT component)...");
  send(server, "tools/call", {
    name: "heartbeat",
    arguments: { action: "status", interval_minutes: 30 },
  });
  const hbResp = await waitForResponse();
  console.log(`   ${hbResp.result?.content?.[0]?.text || JSON.stringify(hbResp.error)}`);

  // --- Step 7: Run agents (needs API key) ---
  console.log("\n7. Running all agents (AGENTS + ORCHESTRATOR)...");
  if (!process.env.YOUTUBE_API_KEY) {
    console.log("   [SKIP] No YOUTUBE_API_KEY set — agent runs require live API access.");
    console.log("   To test live: YOUTUBE_API_KEY=your-key node test-agents.mjs");
  } else {
    send(server, "tools/call", { name: "run_all_agents", arguments: {} });
    const agentResp = await waitForResponse();
    console.log(`   ${agentResp.result?.content?.[0]?.text || JSON.stringify(agentResp.error)}`);

    console.log("\n8. Retrieving stored insights...");
    send(server, "tools/call", { name: "get_insights", arguments: { limit: 10 } });
    const insResp = await waitForResponse();
    console.log(`   ${insResp.result?.content?.[0]?.text || JSON.stringify(insResp.error)}`);
  }

  // --- Done ---
  console.log("\n=== Test Complete ===");
  server.kill();
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
