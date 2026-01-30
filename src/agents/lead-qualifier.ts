import type { AgentConfig, AgentResult } from "./types.js";
import { searchVideos, getVideoComments } from "../services/youtube.js";

export const config: AgentConfig = {
  identity: {
    id: "lead-qualifier",
    name: "Lead Qualifier",
    role: "Identifies buying signals and high-intent discussions in YouTube content and comments.",
  },
  soul: {
    thinkingStyle: "Action-oriented and opportunity-focused. Looks for language that signals purchase intent.",
    boundaries: ["Only flags explicit buying language", "Does not score or rank leads without data"],
    priorities: ["Direct comparison/evaluation comments", "Migration or switching discussions", "Budget and pricing mentions"],
  },
  skills: ["youtube_search_videos", "youtube_get_comments"],
};

const BUYING_SIGNALS = [
  "looking for", "recommend", "alternative to", "switch from", "migrate",
  "compared to", "pricing", "worth it", "should I buy", "vs",
  "better than", "replacement", "which is best", "any suggestions",
  "trial", "demo", "enterprise", "startup", "team of", "budget",
];

function hasBuyingSignal(text: string): string | null {
  const lower = text.toLowerCase();
  return BUYING_SIGNALS.find(s => lower.includes(s)) || null;
}

export async function run(params: {
  keywords: string[];
  videoIds?: string[];
}): Promise<AgentResult> {
  const insights: AgentResult["insights"] = [];

  // Search for high-intent keywords
  for (const keyword of params.keywords) {
    try {
      const intentQuery = `${keyword} review OR comparison OR alternative OR best`;
      const result = await searchVideos(intentQuery, 5);

      if (result.videos.length > 0) {
        // Check comments on the top result for buying signals
        const topVideo = result.videos[0];
        try {
          const comments = await getVideoComments(topVideo.videoId, 30);
          const signalComments = comments.comments
            .map(c => ({ ...c, signal: hasBuyingSignal(c.text) }))
            .filter(c => c.signal !== null);

          if (signalComments.length > 0) {
            insights.push({
              type: "buying_signal",
              title: `${signalComments.length} buying signals in "${topVideo.title}"`,
              detail: signalComments.slice(0, 5).map(c =>
                `- [${c.signal}] "${c.text.slice(0, 100)}" — ${c.authorName} (${c.likeCount} likes)`
              ).join("\n"),
              source: { videoId: topVideo.videoId, query: keyword },
            });
          }
        } catch {
          // comments unavailable
        }
      }
    } catch {
      // search failed
    }
  }

  // Also scan directly provided video IDs
  if (params.videoIds?.length) {
    for (const videoId of params.videoIds) {
      try {
        const comments = await getVideoComments(videoId, 50);
        const signalComments = comments.comments
          .map(c => ({ ...c, signal: hasBuyingSignal(c.text) }))
          .filter(c => c.signal !== null);

        if (signalComments.length > 0) {
          insights.push({
            type: "buying_signal",
            title: `${signalComments.length} buying signals in video comments`,
            detail: signalComments.slice(0, 5).map(c =>
              `- [${c.signal}] "${c.text.slice(0, 100)}" — ${c.authorName}`
            ).join("\n"),
            source: { videoId },
          });
        }
      } catch {
        // skip
      }
    }
  }

  return {
    agentId: config.identity.id,
    success: true,
    summary: `Qualified leads across ${params.keywords.length} keyword(s) and ${params.videoIds?.length || 0} video(s). Found ${insights.length} buying signal clusters.`,
    insights,
  };
}
