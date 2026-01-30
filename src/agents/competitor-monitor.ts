import type { AgentConfig, AgentResult } from "./types.js";
import { getChannelVideos, searchVideos } from "../services/youtube.js";

export const config: AgentConfig = {
  identity: {
    id: "competitor-monitor",
    name: "Competitor Monitor",
    role: "Watches competitor YouTube channels and detects new content, messaging shifts, and product announcements.",
  },
  soul: {
    thinkingStyle: "Analytical and pattern-seeking. Compares current content against past observations to spot changes.",
    boundaries: ["Only reports factual observations, not speculation", "Focuses on content strategy, not vanity metrics"],
    priorities: ["New product announcements", "Messaging or positioning changes", "Content frequency shifts"],
  },
  skills: ["youtube_get_channel_videos", "youtube_search_videos"],
};

export async function run(params: {
  channelIds?: string[];
  keywords?: string[];
}): Promise<AgentResult> {
  const insights: AgentResult["insights"] = [];

  // Monitor tracked channels
  if (params.channelIds?.length) {
    for (const channelId of params.channelIds) {
      try {
        const result = await getChannelVideos(channelId, 5);
        const recent = result.videos.filter(v => {
          const published = new Date(v.publishedAt);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return published > weekAgo;
        });
        if (recent.length > 0) {
          insights.push({
            type: "competitor_move",
            title: `${result.channelTitle}: ${recent.length} new video(s) this week`,
            detail: recent.map(v => `- "${v.title}" (${v.publishedAt.split("T")[0]})`).join("\n"),
            source: { channelId },
          });
        }
      } catch {
        // skip inaccessible channels
      }
    }
  }

  // Monitor competitor keywords
  if (params.keywords?.length) {
    for (const keyword of params.keywords) {
      try {
        const result = await searchVideos(keyword, 5);
        if (result.videos.length > 0) {
          insights.push({
            type: "competitor_move",
            title: `"${keyword}": ${result.totalResults} videos found`,
            detail: result.videos.slice(0, 3).map(v => `- "${v.title}" by ${v.channelTitle}`).join("\n"),
            source: { query: keyword },
          });
        }
      } catch {
        // skip failed searches
      }
    }
  }

  return {
    agentId: config.identity.id,
    success: true,
    summary: `Monitored ${params.channelIds?.length || 0} channels and ${params.keywords?.length || 0} keywords. Found ${insights.length} insights.`,
    insights,
  };
}
