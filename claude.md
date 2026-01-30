# YouTube MCP Server - Project Memory

## Project Overview

YouTube MCP Server — a Model Context Protocol server that enables Claude to perform YouTube social listening for sales intelligence. It searches videos, analyzes comments, monitors competitor channels, and extracts buying signals from YouTube content.

- **Repo**: `Daniiar9/youtube-mcp-server`
- **License**: MIT
- **Runtime**: Node.js (ES2022+, ES modules)
- **Language**: TypeScript 5.7.0
- **Build**: `tsc` (TypeScript compiler)

## Directory Structure

```
youtube-mcp-server/
├── src/
│   ├── index.ts                 # MCP server init + 4 tool registrations (422 lines)
│   ├── schemas/
│   │   └── youtube.ts           # Zod input validation schemas (66 lines)
│   └── services/
│       └── youtube.ts           # YouTube Data API v3 client (291 lines)
├── dist/                        # Compiled JS output
├── package.json                 # ES module, scripts: build/start/dev
├── tsconfig.json                # Strict, ES2022, NodeNext modules
├── README.md
└── LICENSE
```

## Architecture

Three layers:

1. **Schemas** (`src/schemas/youtube.ts`) — Zod validation for all tool inputs
2. **Services** (`src/services/youtube.ts`) — YouTube API communication via `fetchYouTube<T>()`
3. **Server** (`src/index.ts`) — MCP framework wiring, tool registration, response formatting

## MCP Tools

| Tool | Purpose | Key Inputs |
|------|---------|------------|
| `youtube_search_videos` | Search videos by keyword | `query`, `max_results` (1-50), `page_token` |
| `youtube_get_comments` | Fetch video comments | `video_id`, `max_results` (1-100), `page_token` |
| `youtube_get_channel_videos` | Get recent channel uploads | `channel_id` (UC...), `max_results` (1-50), `page_token` |
| `youtube_search_channels` | Find channels by name | `query`, `max_results` (1-10) |

All tools return structured output + formatted text. Pagination supported via page tokens.

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

Requires `YOUTUBE_API_KEY` env variable (YouTube Data API v3 key from Google Cloud Console). Free tier: 10,000 quota units/day.

Claude Code MCP config:

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
- **Response format**: Each tool returns both structured JSON data and human-readable formatted text

## YouTube API Endpoints Used

- `/search` — video and channel search
- `/commentThreads` — video comments (sorted by relevance)
- `/channels` — channel metadata (to get uploads playlist ID)
- `/playlistItems` — channel video listings

## Sales Intelligence Use Cases

- **Competitor Intelligence**: Search reviews, find pain points
- **Buyer Intent**: "Best of" videos, feature request comments
- **Market Research**: Industry problems, customer language
- **Channel Monitoring**: Competitor content strategy

## Related Projects by Author

- **Sales Listener MCP**: Reddit, G2, Hacker News monitoring
- **Sales Copilot MCP**: Sales methodologies and coaching

## Development Notes

- All source is ~780 lines of TypeScript
- Strict TypeScript mode enabled
- ES modules (`"type": "module"` in package.json)
- Source maps and declaration maps enabled
- No test framework currently configured
