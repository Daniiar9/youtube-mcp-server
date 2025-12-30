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

export type SearchVideosInput = z.infer<typeof SearchVideosInputSchema>;
export type GetCommentsInput = z.infer<typeof GetCommentsInputSchema>;
export type GetChannelVideosInput = z.infer<typeof GetChannelVideosInputSchema>;
export type SearchChannelsInput = z.infer<typeof SearchChannelsInputSchema>;
