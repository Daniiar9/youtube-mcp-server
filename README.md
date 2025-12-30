# YouTube MCP Server

MCP server for YouTube social listening. Search videos and analyze comments for sales intelligence.

## What This Does

- **Search YouTube videos** - Find competitor reviews, product comparisons, industry discussions
- **Read video comments** - Extract real opinions, complaints, and buying signals
- **Monitor competitor channels** - Track what competitors are publishing
- **Find channels** - Get channel IDs for any company or creator

## Why YouTube Comments Matter for Sales

YouTube comments are a goldmine:
- People share real opinions (not marketing fluff)
- High like counts = resonant opinions
- Complaints reveal competitor weaknesses
- "What should I use?" = buying signals
- Language people use = copy for your outreach

## Installation

### 1. Get YouTube API Key (Free)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable "YouTube Data API v3"
4. Go to Credentials -> Create Credentials -> API Key
5. Copy the API key

### 2. Install the Server

```bash
# Clone the repo
git clone https://github.com/Daniiar9/youtube-mcp-server.git
cd youtube-mcp-server

# Install dependencies
npm install

# Build
npm run build
```

### 3. Configure Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "youtube": {
      "command": "node",
      "args": ["/path/to/youtube-mcp-server/dist/index.js"],
      "env": {
        "YOUTUBE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Replace `/path/to/youtube-mcp-server` with the actual path where you cloned the repo.

## Usage Examples

**Search for competitor reviews:**
```
Search YouTube for "HubSpot review" and show me the top videos
```

**Analyze comments on a video:**
```
Get comments from this video: youtube.com/watch?v=VIDEO_ID
What are people complaining about?
```

**Monitor competitor channel:**
```
Find Salesforce's YouTube channel and show me their recent videos
```

**Find buying signals:**
```
Search YouTube for "best CRM for startups" and analyze the comments for what features people want
```

## Tools

| Tool | Description |
|------|-------------|
| `youtube_search_videos` | Search for videos by keyword |
| `youtube_get_comments` | Get comments from a specific video |
| `youtube_get_channel_videos` | Get recent videos from a channel |
| `youtube_search_channels` | Find channel IDs by name |

## API Quotas

YouTube API is free with generous limits:
- 10,000 quota units per day
- Search = 100 units (so ~100 searches/day)
- Get comments = 1 unit (so thousands of comment fetches)

For sales use, you'll never hit these limits.

## Use Cases for Sales

### Competitor Intelligence
```
Search "[Competitor] review 2025"
-> Find videos reviewing your competitor
-> Read comments for complaints and praise
-> Extract pain points for your sales conversations
```

### Buyer Intent
```
Search "best [category] for [use case]"
-> Find recommendation videos
-> Read comments for what people are looking for
-> Find people actively asking for suggestions
```

### Market Research
```
Search "[industry] problems" or "[industry] challenges"
-> Find videos discussing pain points
-> Read comments for real struggles
-> Steal language for your outreach
```

### Competitor Monitoring
```
Find competitor's channel
-> Get their recent videos
-> See what topics they're pushing
-> Read comments on their content for sentiment
```

## Related Plugins

This pairs well with:
- [Sales Listener MCP](https://github.com/Daniiar9/sales-listener-mcp) - Reddit, G2, Hacker News monitoring
- [Sales Copilot MCP](https://github.com/Daniiar9/sales-copilot-mcp) - Sales methodologies and coaching

## License

MIT

## Author

Built by [@Daniiar9](https://github.com/Daniiar9)
