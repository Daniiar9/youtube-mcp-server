import type { AgentConfig, AgentResult } from "./types.js";
import { searchVideos } from "../services/youtube.js";

export const config: AgentConfig = {
  identity: {
    id: "trend-spotter",
    name: "Trend Spotter",
    role: "Tracks keyword trends on YouTube to identify emerging topics, rising content, and market shifts.",
  },
  soul: {
    thinkingStyle: "Curious and forward-looking. Identifies patterns across multiple searches.",
    boundaries: ["Reports volume and recency, not causation", "Flags trends, does not predict outcomes"],
    priorities: ["Emerging topics with rising video counts", "New entrants publishing on tracked keywords", "Shift in content format or angle"],
  },
  skills: ["youtube_search_videos"],
};

export async function run(params: {
  keywords: string[];
}): Promise<AgentResult> {
  const insights: AgentResult["insights"] = [];

  for (const keyword of params.keywords) {
    try {
      const result = await searchVideos(keyword, 10);
      const recentVideos = result.videos.filter(v => {
        const published = new Date(v.publishedAt);
        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        return published > twoWeeksAgo;
      });

      // Spot unique channels publishing on this keyword
      const channels = [...new Set(result.videos.map(v => v.channelTitle))];

      insights.push({
        type: "trend",
        title: `"${keyword}": ${result.totalResults} total, ${recentVideos.length} in last 2 weeks`,
        detail: [
          `Top channels: ${channels.slice(0, 5).join(", ")}`,
          recentVideos.length > 0
            ? `Recent: ${recentVideos.slice(0, 3).map(v => `"${v.title}"`).join(", ")}`
            : "No recent videos in the last 2 weeks",
        ].join("\n"),
        source: { query: keyword },
      });
    } catch {
      // skip failed keyword
    }
  }

  return {
    agentId: config.identity.id,
    success: true,
    summary: `Scanned trends for ${params.keywords.length} keyword(s). Found ${insights.length} trend insights.`,
    insights,
  };
}
