# YouTube MCP Server - Project Memory

## Project Overview

YouTube MCP Server — a Model Context Protocol server with a multi-agent architecture for autonomous YouTube social listening and sales intelligence. Searches videos, analyzes comments, monitors competitor channels, extracts buying signals, and stores insights in persistent memory.

- **Repo**: `Daniiar9/youtube-mcp-server`
- **License**: MIT
- **Runtime**: Node.js (ES2022+, ES modules)
- **Language**: TypeScript 5.7.0
- **Build**: `tsc` (TypeScript compiler)

## Directory Structure

```
youtube-mcp-server/
├── src/
│   ├── index.ts                        # MCP server + 11 tool registrations
│   ├── heartbeat.ts                    # Periodic scheduler (start/stop/status)
│   ├── agents/
│   │   ├── types.ts                    # AgentConfig, AgentIdentity, AgentSoul, AgentResult
│   │   ├── orchestrator.ts             # Routes tasks to agents, runs all agents
│   │   ├── competitor-monitor.ts       # Watches channels, detects new content
│   │   ├── sentiment-analyst.ts        # Classifies comments by sentiment
│   │   ├── trend-spotter.ts            # Tracks keyword volume and recency
│   │   └── lead-qualifier.ts           # Identifies buying signals in comments
│   ├── memory/
│   │   └── store.ts                    # File-based JSON persistence for all state
│   ├── schemas/
│   │   └── youtube.ts                  # Zod input validation (original + agent schemas)
│   └── services/
│       └── youtube.ts                  # YouTube Data API v3 client (unchanged)
├── dist/                               # Compiled JS output
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

## Architecture

Five layers (maps to the agent diagram):

1. **Services** (`src/services/youtube.ts`) — YouTube API primitives (SKILLS plumbing)
2. **Schemas** (`src/schemas/youtube.ts`) — Zod validation for all 11 tools
3. **Memory** (`src/memory/store.ts`) — Persistent JSON store: user profile, monitors, insights, conversations
4. **Agents** (`src/agents/`) — 4 specialized agents with identity/soul/skills, plus orchestrator
5. **Server** (`src/index.ts`) — MCP framework wiring, all tool registrations, heartbeat init

### Agent Architecture Components

| Component | File(s) | Purpose |
|-----------|---------|---------|
| **HEARTBEAT** | `src/heartbeat.ts` | Periodic execution of all agents (configurable interval) |
| **AGENTS** | `src/agents/*.ts` | 4 specialized agents with distinct roles |
| **SKILLS** | `src/services/youtube.ts` | YouTube API tools distributed to agents |
| **MEMORY** | `src/memory/store.ts` | Persistent state: user, monitors, insights, conversations |
| **IDENTITY** | Agent `config.identity` | Name, ID, role description per agent |
| **SOUL** | Agent `config.soul` | Thinking style, boundaries, priorities per agent |
| **USER** | Memory `user` field | Industry, competitors, keywords, tracked channels, notes |

## MCP Tools (11 total)

### Original YouTube Tools (4)

| Tool | Purpose | Key Inputs |
|------|---------|------------|
| `youtube_search_videos` | Search videos by keyword | `query`, `max_results`, `page_token` |
| `youtube_get_comments` | Fetch video comments | `video_id`, `max_results`, `page_token` |
| `youtube_get_channel_videos` | Get recent channel uploads | `channel_id`, `max_results`, `page_token` |
| `youtube_search_channels` | Find channels by name | `query`, `max_results` |

### Agent Architecture Tools (7)

| Tool | Purpose | Key Inputs |
|------|---------|------------|
| `configure_user` | Set user profile (USER component) | `industry`, `competitors`, `keywords`, `tracked_channels`, `notes` |
| `run_agent` | Run a specific agent | `agent_id`, `params` |
| `run_all_agents` | Run all agents using user profile | (none) |
| `get_insights` | Retrieve stored insights | `agent_id`, `type`, `limit` |
| `heartbeat` | Start/stop/status periodic agent runs | `action`, `interval_minutes` |
| `add_monitor` | Add channel/keyword to watch list | `type`, `value` |
| `get_memory` | View full memory state | (none) |

## Agents

### Competitor Monitor (`competitor-monitor`)
- **Role**: Watches channels, detects new content and messaging shifts
- **Skills**: `youtube_get_channel_videos`, `youtube_search_videos`
- **Soul**: Analytical, pattern-seeking. Compares current vs past. Reports facts only.
- **Runs when**: User has tracked channels or competitors

### Sentiment Analyst (`sentiment-analyst`)
- **Role**: Classifies comments as positive/negative/neutral/request
- **Skills**: `youtube_get_comments`
- **Soul**: Skeptical, evidence-based. Reports direct quotes.
- **Runs when**: Video IDs are provided

### Trend Spotter (`trend-spotter`)
- **Role**: Tracks keyword volume and identifies emerging topics
- **Skills**: `youtube_search_videos`
- **Soul**: Curious, forward-looking. Reports volume and recency.
- **Runs when**: User has keywords

### Lead Qualifier (`lead-qualifier`)
- **Role**: Identifies buying signals in video content and comments
- **Skills**: `youtube_search_videos`, `youtube_get_comments`
- **Soul**: Action-oriented, opportunity-focused. Flags explicit buying language.
- **Buying signals detected**: "looking for", "recommend", "alternative to", "switch from", "pricing", "vs", "which is best", etc.
- **Runs when**: User has keywords or competitors

## Memory System

File-based JSON persistence at `.youtube-mcp-memory.json` (or `YOUTUBE_MCP_MEMORY_PATH` env).

```typescript
interface MemoryState {
  user: UserProfile;        // Industry, competitors, keywords, channels, notes
  monitors: MonitorTarget[];  // Channel/keyword watch list with timestamps
  insights: InsightEntry[];   // Agent-generated insights (max 500)
  conversations: ConversationEntry[];  // Interaction log (max 200)
}
```

Insight types: `buying_signal`, `competitor_move`, `sentiment`, `trend`

## Dependencies

- `@modelcontextprotocol/sdk` v1.12.0 — MCP protocol
- `zod` v3.24.0 — Schema validation
- `typescript` v5.7.0 (dev)
- `@types/node` v22.0.0 (dev)

## Scripts

```bash
npm run build    # tsc → dist/
npm run dev      # tsc --watch
npm start        # node dist/index.js
```

## Configuration

Requires `YOUTUBE_API_KEY` env variable. Optional: `YOUTUBE_MCP_MEMORY_PATH` for custom memory file location.

```json
{
  "mcpServers": {
    "youtube": {
      "command": "node",
      "args": ["/path/to/youtube-mcp-server/dist/index.js"],
      "env": {
        "YOUTUBE_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Key Implementation Details

- **API Base**: `https://www.googleapis.com/youtube/v3`
- **Auth**: API key passed as query parameter
- **Error handling**: Specific 403 (quota/disabled comments) and 400 (invalid request) handling
- **Transport**: stdio-based MCP server
- **Response format**: Original 4 tools return structured + text; agent tools return text only
- **Heartbeat**: `setInterval`-based, runs all agents, persists insights, updates monitor timestamps

## Development Notes

- Strict TypeScript mode enabled
- ES modules (`"type": "module"` in package.json)
- Source maps and declaration maps enabled
- No test framework currently configured
- `src/services/youtube.ts` is unchanged from pre-agent architecture — agents compose on top of it
