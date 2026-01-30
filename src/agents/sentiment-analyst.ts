import type { AgentConfig, AgentResult } from "./types.js";
import { getVideoComments } from "../services/youtube.js";

export const config: AgentConfig = {
  identity: {
    id: "sentiment-analyst",
    name: "Sentiment Analyst",
    role: "Analyzes YouTube comments to extract sentiment patterns, complaints, praise, and feature requests.",
  },
  soul: {
    thinkingStyle: "Skeptical and evidence-based. Classifies by observable language, not assumptions.",
    boundaries: ["Reports direct quotes", "Does not infer intent beyond stated words"],
    priorities: ["Pain points and complaints", "Feature requests", "Competitor comparisons in comments"],
  },
  skills: ["youtube_get_comments"],
};

function classifyComment(text: string): "positive" | "negative" | "neutral" | "request" {
  const lower = text.toLowerCase();
  const negativeSignals = ["hate", "worst", "terrible", "disappointed", "broken", "bug", "sucks", "awful", "poor", "bad", "frustrat", "annoying", "useless"];
  const positiveSignals = ["love", "amazing", "great", "best", "awesome", "excellent", "perfect", "helpful", "fantastic"];
  const requestSignals = ["wish", "please add", "should have", "need", "feature", "would be nice", "can you add", "suggestion", "hope they"];

  if (requestSignals.some(s => lower.includes(s))) return "request";
  if (negativeSignals.some(s => lower.includes(s))) return "negative";
  if (positiveSignals.some(s => lower.includes(s))) return "positive";
  return "neutral";
}

export async function run(params: {
  videoIds: string[];
}): Promise<AgentResult> {
  const insights: AgentResult["insights"] = [];

  for (const videoId of params.videoIds) {
    try {
      const result = await getVideoComments(videoId, 50);
      const classified = result.comments.map(c => ({
        ...c,
        sentiment: classifyComment(c.text),
      }));

      const negatives = classified.filter(c => c.sentiment === "negative");
      const requests = classified.filter(c => c.sentiment === "request");
      const positives = classified.filter(c => c.sentiment === "positive");

      if (negatives.length > 0) {
        insights.push({
          type: "sentiment",
          title: `${negatives.length} negative comments on video`,
          detail: negatives.slice(0, 5).map(c => `- "${c.text.slice(0, 120)}" (${c.likeCount} likes)`).join("\n"),
          source: { videoId },
        });
      }

      if (requests.length > 0) {
        insights.push({
          type: "buying_signal",
          title: `${requests.length} feature requests / wishes`,
          detail: requests.slice(0, 5).map(c => `- "${c.text.slice(0, 120)}" (${c.likeCount} likes)`).join("\n"),
          source: { videoId },
        });
      }

      if (positives.length > 0) {
        insights.push({
          type: "sentiment",
          title: `${positives.length} positive comments`,
          detail: positives.slice(0, 3).map(c => `- "${c.text.slice(0, 120)}"`).join("\n"),
          source: { videoId },
        });
      }
    } catch {
      // comments disabled or inaccessible
    }
  }

  return {
    agentId: config.identity.id,
    success: true,
    summary: `Analyzed comments on ${params.videoIds.length} video(s). Found ${insights.length} sentiment insights.`,
    insights,
  };
}
