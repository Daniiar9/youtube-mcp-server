import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  SearchVideosInputSchema,
  GetCommentsInputSchema,
  GetChannelVideosInputSchema,
  SearchChannelsInputSchema,
  type SearchVideosInput,
  type GetCommentsInput,
  type GetChannelVideosInput,
  type SearchChannelsInput
} from "./schemas/youtube.js";
import {
  searchVideos,
  getVideoComments,
  getChannelVideos,
  searchChannels
} from "./services/youtube.js";

const server = new McpServer({
  name: "youtube-mcp-server",
  version: "1.0.0"
});

// Tool: Search YouTube Videos
server.registerTool(
  "youtube_search_videos",
  {
    title: "Search YouTube Videos",
    description: `Search YouTube for videos matching a query. Use for finding competitor content, product reviews, industry discussions, and buyer intent signals.

Sales use cases:
- Search "[Competitor] review" to find videos discussing competitors
- Search "best [category] 2025" to find recommendation videos
- Search "[industry] problems" to find pain point discussions
- Search "[Competitor] vs" to find comparison videos

Args:
  - query (string): Search terms - be specific for better results
  - max_results (number): How many videos to return (1-50, default: 10)
  - page_token (string): For pagination, use nextPageToken from previous response

Returns:
  List of videos with: videoId, title, description, channelTitle, publishedAt, thumbnailUrl
  Plus nextPageToken if more results available`,
    inputSchema: SearchVideosInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: SearchVideosInput) => {
    try {
      const result = await searchVideos(
        params.query,
        params.max_results,
        params.page_token
      );

      const output = {
        query: params.query,
        totalResults: result.totalResults,
        returnedCount: result.videos.length,
        videos: result.videos.map(v => ({
          videoId: v.videoId,
          title: v.title,
          description: v.description.slice(0, 200) + (v.description.length > 200 ? "..." : ""),
          channelTitle: v.channelTitle,
          publishedAt: v.publishedAt,
          url: `https://youtube.com/watch?v=${v.videoId}`
        })),
        nextPageToken: result.nextPageToken
      };

      const text = formatVideosAsText(output);

      return {
        content: [{ type: "text", text }],
        structuredContent: output
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error searching videos: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool: Get Video Comments
server.registerTool(
  "youtube_get_comments",
  {
    title: "Get YouTube Video Comments",
    description: `Fetch comments from a specific YouTube video. This is where the real insights are - what people actually think about products, competitors, and problems.

Sales use cases:
- Read comments on competitor review videos for pain points
- Find complaints and frustrations people share
- Discover what features people ask for
- See how people describe their problems (steal their language)

Args:
  - video_id (string): The YouTube video ID (from youtube.com/watch?v=VIDEO_ID)
  - max_results (number): How many comments to return (1-100, default: 50)
  - page_token (string): For pagination

Returns:
  List of comments with: text, authorName, likeCount, publishedAt, replyCount
  Sorted by relevance (most liked/engaged first)`,
    inputSchema: GetCommentsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetCommentsInput) => {
    try {
      const result = await getVideoComments(
        params.video_id,
        params.max_results,
        params.page_token
      );

      const output = {
        videoId: params.video_id,
        videoUrl: `https://youtube.com/watch?v=${params.video_id}`,
        totalComments: result.totalResults,
        returnedCount: result.comments.length,
        comments: result.comments.map(c => ({
          text: c.text,
          authorName: c.authorName,
          likeCount: c.likeCount,
          replyCount: c.replyCount || 0,
          publishedAt: c.publishedAt
        })),
        nextPageToken: result.nextPageToken
      };

      const text = formatCommentsAsText(output);

      return {
        content: [{ type: "text", text }],
        structuredContent: output
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes("disabled comments") || errorMessage.includes("403")) {
        return {
          content: [{
            type: "text",
            text: `Comments are disabled for this video (${params.video_id}). Try a different video.`
          }]
        };
      }

      return {
        content: [{
          type: "text",
          text: `Error fetching comments: ${errorMessage}`
        }],
        isError: true
      };
    }
  }
);

// Tool: Get Channel Videos
server.registerTool(
  "youtube_get_channel_videos",
  {
    title: "Get YouTube Channel Videos",
    description: `Get recent videos from a specific YouTube channel. Use to monitor competitor channels or industry influencers.

Sales use cases:
- Monitor competitor's YouTube channel for new content
- Track what topics they're publishing about
- Find their product announcement videos
- See their messaging and positioning

Args:
  - channel_id (string): YouTube channel ID (starts with UC...). Use youtube_search_channels to find this.
  - max_results (number): How many videos to return (1-50, default: 10)
  - page_token (string): For pagination

Returns:
  List of recent videos from the channel with titles, descriptions, and publish dates`,
    inputSchema: GetChannelVideosInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetChannelVideosInput) => {
    try {
      const result = await getChannelVideos(
        params.channel_id,
        params.max_results,
        params.page_token
      );

      const output = {
        channelId: params.channel_id,
        channelTitle: result.channelTitle,
        returnedCount: result.videos.length,
        videos: result.videos.map(v => ({
          videoId: v.videoId,
          title: v.title,
          description: v.description.slice(0, 200) + (v.description.length > 200 ? "..." : ""),
          publishedAt: v.publishedAt,
          url: `https://youtube.com/watch?v=${v.videoId}`
        })),
        nextPageToken: result.nextPageToken
      };

      const text = formatChannelVideosAsText(output);

      return {
        content: [{ type: "text", text }],
        structuredContent: output
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error fetching channel videos: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool: Search Channels
server.registerTool(
  "youtube_search_channels",
  {
    title: "Search YouTube Channels",
    description: `Search for YouTube channels by name. Use this to find channel IDs for competitors or industry influencers.

Args:
  - query (string): Channel name to search for (e.g., "HubSpot", "Salesforce", "Gong")
  - max_results (number): How many channels to return (1-10, default: 5)

Returns:
  List of channels with: channelId, title, description

Use the channelId with youtube_get_channel_videos to see their content.`,
    inputSchema: SearchChannelsInputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: SearchChannelsInput) => {
    try {
      const channels = await searchChannels(params.query, params.max_results);

      const output = {
        query: params.query,
        returnedCount: channels.length,
        channels: channels.map(c => ({
          channelId: c.channelId,
          title: c.title,
          description: c.description.slice(0, 150) + (c.description.length > 150 ? "..." : ""),
          channelUrl: `https://youtube.com/channel/${c.channelId}`
        }))
      };

      const text = formatChannelsAsText(output);

      return {
        content: [{ type: "text", text }],
        structuredContent: output
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error searching channels: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Formatting helpers
function formatVideosAsText(output: {
  query: string;
  totalResults: number;
  returnedCount: number;
  videos: Array<{
    videoId: string;
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
    url: string;
  }>;
  nextPageToken?: string;
}): string {
  let text = `Found ${output.totalResults} videos for "${output.query}" (showing ${output.returnedCount})\n\n`;

  output.videos.forEach((v, i) => {
    text += `${i + 1}. ${v.title}\n`;
    text += `   Channel: ${v.channelTitle}\n`;
    text += `   Published: ${v.publishedAt.split("T")[0]}\n`;
    text += `   URL: ${v.url}\n`;
    text += `   Video ID: ${v.videoId}\n\n`;
  });

  if (output.nextPageToken) {
    text += `\nMore results available. Use page_token: "${output.nextPageToken}" to get next page.`;
  }

  return text;
}

function formatCommentsAsText(output: {
  videoId: string;
  videoUrl: string;
  totalComments: number;
  returnedCount: number;
  comments: Array<{
    text: string;
    authorName: string;
    likeCount: number;
    replyCount: number;
    publishedAt: string;
  }>;
  nextPageToken?: string;
}): string {
  let text = `Comments for video: ${output.videoUrl}\n`;
  text += `Total: ${output.totalComments} | Showing: ${output.returnedCount}\n\n`;

  output.comments.forEach((c, i) => {
    text += `${i + 1}. [${c.likeCount} likes, ${c.replyCount} replies] ${c.authorName}:\n`;
    text += `   "${c.text}"\n\n`;
  });

  if (output.nextPageToken) {
    text += `\nMore comments available. Use page_token: "${output.nextPageToken}" to get next page.`;
  }

  return text;
}

function formatChannelVideosAsText(output: {
  channelId: string;
  channelTitle: string;
  returnedCount: number;
  videos: Array<{
    videoId: string;
    title: string;
    description: string;
    publishedAt: string;
    url: string;
  }>;
  nextPageToken?: string;
}): string {
  let text = `Recent videos from ${output.channelTitle} (${output.returnedCount} videos)\n\n`;

  output.videos.forEach((v, i) => {
    text += `${i + 1}. ${v.title}\n`;
    text += `   Published: ${v.publishedAt.split("T")[0]}\n`;
    text += `   URL: ${v.url}\n`;
    text += `   Video ID: ${v.videoId}\n\n`;
  });

  if (output.nextPageToken) {
    text += `\nMore videos available. Use page_token: "${output.nextPageToken}" to get next page.`;
  }

  return text;
}

function formatChannelsAsText(output: {
  query: string;
  returnedCount: number;
  channels: Array<{
    channelId: string;
    title: string;
    description: string;
    channelUrl: string;
  }>;
}): string {
  let text = `Found ${output.returnedCount} channels for "${output.query}"\n\n`;

  output.channels.forEach((c, i) => {
    text += `${i + 1}. ${c.title}\n`;
    text += `   Channel ID: ${c.channelId}\n`;
    text += `   URL: ${c.channelUrl}\n`;
    text += `   Description: ${c.description}\n\n`;
  });

  return text;
}

// Run the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("YouTube MCP Server running on stdio");
}

main().catch(error => {
  console.error("Server error:", error);
  process.exit(1);
});
