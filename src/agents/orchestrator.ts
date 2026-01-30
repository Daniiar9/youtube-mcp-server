import type { AgentResult } from "./types.js";
import { loadMemory, addInsight } from "../memory/store.js";
import * as competitorMonitor from "./competitor-monitor.js";
import * as sentimentAnalyst from "./sentiment-analyst.js";
import * as trendSpotter from "./trend-spotter.js";
import * as leadQualifier from "./lead-qualifier.js";

export type AgentId = "competitor-monitor" | "sentiment-analyst" | "trend-spotter" | "lead-qualifier";

const agents = {
  "competitor-monitor": competitorMonitor,
  "sentiment-analyst": sentimentAnalyst,
  "trend-spotter": trendSpotter,
  "lead-qualifier": leadQualifier,
} as const;

export function listAgents() {
  return Object.values(agents).map(a => ({
    id: a.config.identity.id,
    name: a.config.identity.name,
    role: a.config.identity.role,
    skills: a.config.skills,
    soul: a.config.soul,
  }));
}

export async function runAgent(agentId: AgentId, params: Record<string, unknown>): Promise<AgentResult> {
  const agent = agents[agentId];
  if (!agent) {
    return { agentId, success: false, summary: `Unknown agent: ${agentId}`, insights: [] };
  }

  const result = await agent.run(params as never);

  // Persist insights to memory
  for (const insight of result.insights) {
    await addInsight({ ...insight, agentId });
  }

  return result;
}

export async function runAllAgents(): Promise<AgentResult[]> {
  const state = await loadMemory();
  const results: AgentResult[] = [];

  const { user } = state;
  const hasChannels = user.trackedChannels.length > 0;
  const hasKeywords = user.keywords.length > 0;
  const hasCompetitors = user.competitors.length > 0;

  if (!hasChannels && !hasKeywords && !hasCompetitors) {
    return [{
      agentId: "orchestrator",
      success: false,
      summary: "No user profile configured. Use configure_user to set competitors, keywords, or tracked channels.",
      insights: [],
    }];
  }

  // Competitor Monitor — needs channels or competitor names
  if (hasChannels || hasCompetitors) {
    const result = await runAgent("competitor-monitor", {
      channelIds: user.trackedChannels,
      keywords: user.competitors.map(c => `${c} review`),
    });
    results.push(result);
  }

  // Trend Spotter — needs keywords
  if (hasKeywords) {
    const result = await runAgent("trend-spotter", { keywords: user.keywords });
    results.push(result);
  }

  // Lead Qualifier — needs keywords or competitors
  if (hasKeywords || hasCompetitors) {
    const result = await runAgent("lead-qualifier", {
      keywords: [...user.keywords, ...user.competitors],
    });
    results.push(result);
  }

  return results;
}
