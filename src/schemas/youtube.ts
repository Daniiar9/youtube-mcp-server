import { z } from "zod";

export const SearchVideosInputSchema = z.object({
  query: z.string()
    .min(1, "Query cannot be empty")
    .max(500, "Query must not exceed 500 characters")
    .describe("Search query - can include competitor names, product categories, or keywords like '[Competitor] review' or 'best [category] 2025'"),
  max_results: z.number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum number of videos to return (1-50, default: 10)"),
  page_token: z.string()
    .optional()
    .describe("Token for pagination - use nextPageToken from previous response to get more results")
}).strict();

export const GetCommentsInputSchema = z.object({
  video_id: z.string()
    .min(1, "Video ID cannot be empty")
    .describe("YouTube video ID (the part after v= in youtube.com/watch?v=VIDEO_ID)"),
  max_results: z.number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe("Maximum number of comments to return (1-100, default: 50)"),
  page_token: z.string()
    .optional()
    .describe("Token for pagination - use nextPageToken from previous response to get more comments")
}).strict();

export const GetChannelVideosInputSchema = z.object({
  channel_id: z.string()
    .min(1, "Channel ID cannot be empty")
    .describe("YouTube channel ID (starts with UC...). Use youtube_search_channels to find channel IDs."),
  max_results: z.number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum number of videos to return (1-50, default: 10)"),
  page_token: z.string()
    .optional()
    .describe("Token for pagination - use nextPageToken from previous response to get more videos")
}).strict();

export const SearchChannelsInputSchema = z.object({
  query: z.string()
    .min(1, "Query cannot be empty")
    .max(200, "Query must not exceed 200 characters")
    .describe("Search query for finding YouTube channels - typically a company or brand name"),
  max_results: z.number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .describe("Maximum number of channels to return (1-10, default: 5)")
}).strict();

// --- Agent Architecture Schemas ---

export const ConfigureUserInputSchema = z.object({
  industry: z.string().optional().describe("Your industry (e.g., 'SaaS', 'E-commerce', 'Fintech')"),
  competitors: z.array(z.string()).optional().describe("List of competitor names to track"),
  keywords: z.array(z.string()).optional().describe("Keywords to monitor (e.g., 'best CRM', 'project management tool')"),
  tracked_channels: z.array(z.string()).optional().describe("YouTube channel IDs (UC...) to monitor"),
  notes: z.array(z.string()).optional().describe("Additional context about your business"),
}).strict();

export const RunAgentInputSchema = z.object({
  agent_id: z.enum(["competitor-monitor", "sentiment-analyst", "trend-spotter", "lead-qualifier"])
    .describe("Which agent to run"),
  params: z.record(z.unknown()).optional().describe("Agent-specific parameters (channelIds, keywords, videoIds)"),
}).strict();

export const RunAllAgentsInputSchema = z.object({}).strict();

export const GetInsightsInputSchema = z.object({
  agent_id: z.enum(["competitor-monitor", "sentiment-analyst", "trend-spotter", "lead-qualifier"]).optional()
    .describe("Filter by agent"),
  type: z.enum(["buying_signal", "competitor_move", "sentiment", "trend"]).optional()
    .describe("Filter by insight type"),
  limit: z.number().int().min(1).max(100).default(20).describe("Max insights to return"),
}).strict();

export const HeartbeatInputSchema = z.object({
  action: z.enum(["start", "stop", "status"]).describe("Start, stop, or check heartbeat status"),
  interval_minutes: z.number().int().min(5).max(120).default(30)
    .describe("How often to run all agents (minutes, default 30)"),
}).strict();

export const AddMonitorInputSchema = z.object({
  type: z.enum(["channel", "keyword"]).describe("What to monitor"),
  value: z.string().min(1).describe("Channel ID or keyword to monitor"),
}).strict();

export const GetMemoryInputSchema = z.object({}).strict();

// --- Type Exports ---

export type SearchVideosInput = z.infer<typeof SearchVideosInputSchema>;
export type GetCommentsInput = z.infer<typeof GetCommentsInputSchema>;
export type GetChannelVideosInput = z.infer<typeof GetChannelVideosInputSchema>;
export type SearchChannelsInput = z.infer<typeof SearchChannelsInputSchema>;
export type ConfigureUserInput = z.infer<typeof ConfigureUserInputSchema>;
export type RunAgentInput = z.infer<typeof RunAgentInputSchema>;
export type RunAllAgentsInput = z.infer<typeof RunAllAgentsInputSchema>;
export type GetInsightsInput = z.infer<typeof GetInsightsInputSchema>;
export type HeartbeatInput = z.infer<typeof HeartbeatInputSchema>;
export type AddMonitorInput = z.infer<typeof AddMonitorInputSchema>;
export type GetMemoryInput = z.infer<typeof GetMemoryInputSchema>;
