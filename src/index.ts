import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  SearchVideosInputSchema,
  GetCommentsInputSchema,
  GetChannelVideosInputSchema,
  SearchChannelsInputSchema,
  ConfigureUserInputSchema,
  RunAgentInputSchema,
  RunAllAgentsInputSchema,
  GetInsightsInputSchema,
  HeartbeatInputSchema,
  AddMonitorInputSchema,
  GetMemoryInputSchema,
  type SearchVideosInput,
  type GetCommentsInput,
  type GetChannelVideosInput,
  type SearchChannelsInput,
  type ConfigureUserInput,
  type RunAgentInput,
  type GetInsightsInput,
  type HeartbeatInput,
  type AddMonitorInput,
} from "./schemas/youtube.js";
import {
  searchVideos,
  getVideoComments,
  getChannelVideos,
  searchChannels
} from "./services/youtube.js";
import { listAgents, runAgent, runAllAgents, type AgentId } from "./agents/orchestrator.js";
import { updateUser, loadMemory, getInsights, addMonitor, removeMonitor, addConversation } from "./memory/store.js";
import { startHeartbeat, stopHeartbeat, isHeartbeatRunning } from "./heartbeat.js";

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

// =================================================================
// Agent Architecture Tools
// =================================================================

// Tool: Configure User Profile
server.registerTool(
  "configure_user",
  {
    title: "Configure User Profile",
    description: `Set up your profile so agents know what to monitor. Configures your industry, competitors, keywords, and tracked channels.

This is the USER component of the agent system — all agents use this to tailor their work to you.

Args:
  - industry (string): Your industry
  - competitors (string[]): Competitor names
  - keywords (string[]): Keywords to track
  - tracked_channels (string[]): YouTube channel IDs to monitor
  - notes (string[]): Extra context about your business`,
    inputSchema: ConfigureUserInputSchema,
  },
  async (params: ConfigureUserInput) => {
    try {
      const updates: Record<string, unknown> = {};
      if (params.industry !== undefined) updates.industry = params.industry;
      if (params.competitors !== undefined) updates.competitors = params.competitors;
      if (params.keywords !== undefined) updates.keywords = params.keywords;
      if (params.tracked_channels !== undefined) updates.trackedChannels = params.tracked_channels;
      if (params.notes !== undefined) updates.notes = params.notes;

      const user = await updateUser(updates);
      await addConversation({ role: "user", content: `Configured profile: ${JSON.stringify(params)}` });

      const text = [
        "User profile updated:",
        `  Industry: ${user.industry || "(not set)"}`,
        `  Competitors: ${user.competitors.length > 0 ? user.competitors.join(", ") : "(none)"}`,
        `  Keywords: ${user.keywords.length > 0 ? user.keywords.join(", ") : "(none)"}`,
        `  Tracked Channels: ${user.trackedChannels.length > 0 ? user.trackedChannels.join(", ") : "(none)"}`,
        `  Notes: ${user.notes.length > 0 ? user.notes.join("; ") : "(none)"}`,
      ].join("\n");

      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// Tool: Run a specific agent
server.registerTool(
  "run_agent",
  {
    title: "Run Agent",
    description: `Run a specific agent from the multi-agent system.

Available agents:
  - competitor-monitor: Watches channels and searches competitor keywords
  - sentiment-analyst: Analyzes comments for sentiment and feature requests
  - trend-spotter: Tracks keyword trends and emerging topics
  - lead-qualifier: Identifies buying signals in videos and comments

Args:
  - agent_id: Which agent to run
  - params: Agent-specific parameters (e.g., { channelIds: [...], keywords: [...], videoIds: [...] })

If no params provided, agent uses your saved user profile.`,
    inputSchema: RunAgentInputSchema,
  },
  async (params: RunAgentInput) => {
    try {
      let agentParams = params.params || {};

      // If no params, use user profile defaults
      if (Object.keys(agentParams).length === 0) {
        const state = await loadMemory();
        agentParams = {
          channelIds: state.user.trackedChannels,
          keywords: [...state.user.keywords, ...state.user.competitors],
          videoIds: [],
        };
      }

      const result = await runAgent(params.agent_id as AgentId, agentParams as Record<string, unknown>);
      await addConversation({ role: "agent", agentId: params.agent_id, content: result.summary });

      let text = `Agent: ${params.agent_id}\nStatus: ${result.success ? "Success" : "Failed"}\nSummary: ${result.summary}\n`;
      if (result.insights.length > 0) {
        text += `\nInsights (${result.insights.length}):\n`;
        result.insights.forEach((ins, i) => {
          text += `\n${i + 1}. [${ins.type}] ${ins.title}\n   ${ins.detail.split("\n").join("\n   ")}\n`;
        });
      }

      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// Tool: Run all agents
server.registerTool(
  "run_all_agents",
  {
    title: "Run All Agents",
    description: `Run all agents based on your configured user profile. This is what the heartbeat calls periodically.

Agents run based on your profile:
  - Competitor Monitor: runs if you have tracked channels or competitors
  - Trend Spotter: runs if you have keywords
  - Lead Qualifier: runs if you have keywords or competitors

No args needed — uses your saved profile.`,
    inputSchema: RunAllAgentsInputSchema,
  },
  async () => {
    try {
      const results = await runAllAgents();
      const totalInsights = results.reduce((sum, r) => sum + r.insights.length, 0);
      await addConversation({ role: "agent", agentId: "orchestrator", content: `Ran all agents: ${totalInsights} insights` });

      let text = `Ran ${results.length} agent(s). Total insights: ${totalInsights}\n`;
      results.forEach(r => {
        text += `\n--- ${r.agentId} ---\n${r.summary}\n`;
        r.insights.forEach((ins, i) => {
          text += `  ${i + 1}. [${ins.type}] ${ins.title}\n`;
        });
      });

      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// Tool: Get stored insights
server.registerTool(
  "get_insights",
  {
    title: "Get Insights",
    description: `Retrieve stored insights from agent runs. Insights persist in memory across sessions.

Filter by agent or insight type to narrow results.

Args:
  - agent_id: Filter by agent (optional)
  - type: Filter by type — buying_signal, competitor_move, sentiment, trend (optional)
  - limit: Max results (1-100, default 20)`,
    inputSchema: GetInsightsInputSchema,
  },
  async (params: GetInsightsInput) => {
    try {
      const insights = await getInsights({
        agentId: params.agent_id,
        type: params.type,
        limit: params.limit,
      });

      let text = `Insights (${insights.length}):\n`;
      insights.forEach((ins, i) => {
        text += `\n${i + 1}. [${ins.type}] ${ins.title} (by ${ins.agentId}, ${ins.createdAt.split("T")[0]})\n   ${ins.detail.split("\n").join("\n   ")}\n`;
      });

      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// Tool: Heartbeat control
server.registerTool(
  "heartbeat",
  {
    title: "Heartbeat Control",
    description: `Control the periodic heartbeat that runs all agents automatically.

Args:
  - action: "start" to begin, "stop" to end, "status" to check
  - interval_minutes: How often to run (5-120, default 30)

When running, the heartbeat executes all agents on your configured schedule and stores insights in memory.`,
    inputSchema: HeartbeatInputSchema,
  },
  async (params: HeartbeatInput) => {
    try {
      let text = "";
      let data: Record<string, unknown> = {};

      if (params.action === "start") {
        const result = startHeartbeat(params.interval_minutes);
        text = result.started
          ? `Heartbeat started. Running all agents every ${result.intervalMinutes} minutes.`
          : `Heartbeat is already running (every ${result.intervalMinutes} minutes).`;
        data = result;
      } else if (params.action === "stop") {
        const stopped = stopHeartbeat();
        text = stopped ? "Heartbeat stopped." : "Heartbeat was not running.";
        data = { stopped };
      } else {
        const running = isHeartbeatRunning();
        text = running ? "Heartbeat is running." : "Heartbeat is not running.";
        data = { running };
      }

      return { content: [{ type: "text", text }], structuredContent: data };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// Tool: Add monitor target
server.registerTool(
  "add_monitor",
  {
    title: "Add Monitor Target",
    description: `Add a channel or keyword to the monitoring list. Monitored targets are checked by agents during heartbeat runs.

Args:
  - type: "channel" or "keyword"
  - value: The channel ID or keyword string`,
    inputSchema: AddMonitorInputSchema,
  },
  async (params: AddMonitorInput) => {
    try {
      const monitor = await addMonitor(params.type, params.value);
      const text = `Monitor added: [${monitor.type}] "${monitor.value}" (id: ${monitor.id})`;
      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// Tool: Get full memory state
server.registerTool(
  "get_memory",
  {
    title: "Get Memory",
    description: `View the full memory state: user profile, monitors, recent insights, and conversation log. This is the system's complete knowledge base.`,
    inputSchema: GetMemoryInputSchema,
  },
  async () => {
    try {
      const state = await loadMemory();
      const agentList = listAgents();

      let text = "=== MEMORY STATE ===\n\n";
      text += "USER PROFILE:\n";
      text += `  Industry: ${state.user.industry || "(not set)"}\n`;
      text += `  Competitors: ${state.user.competitors.join(", ") || "(none)"}\n`;
      text += `  Keywords: ${state.user.keywords.join(", ") || "(none)"}\n`;
      text += `  Tracked Channels: ${state.user.trackedChannels.join(", ") || "(none)"}\n`;

      text += `\nMONITORS (${state.monitors.length}):\n`;
      state.monitors.forEach(m => {
        text += `  - [${m.type}] ${m.value} (last checked: ${m.lastCheckedAt || "never"})\n`;
      });

      text += `\nINSIGHTS (${state.insights.length} stored):\n`;
      state.insights.slice(-5).forEach(ins => {
        text += `  - [${ins.type}] ${ins.title} (${ins.createdAt.split("T")[0]})\n`;
      });

      text += `\nAGENTS (${agentList.length}):\n`;
      agentList.forEach(a => {
        text += `  - ${a.name} (${a.id}): ${a.role.slice(0, 80)}\n`;
      });

      text += `\nHEARTBEAT: ${isHeartbeatRunning() ? "Running" : "Stopped"}\n`;
      text += `CONVERSATIONS: ${state.conversations.length} entries\n`;

      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
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
