# frqr-mcp

MCP server for [frqr.app](https://frqr.app) — short links, trackable QR codes and analytics directly inside Claude Desktop, Cursor, and any MCP-compatible client.

## Tools available

| Tool | Description |
|------|-------------|
| `create_link` | Shorten a URL and get a frqr.app short link |
| `list_links` | List your short links (with search and pagination) |
| `get_link_stats` | Clicks, countries, devices and browsers for a link |
| `update_link` | Change destination, title or disable a link |
| `delete_link` | Permanently delete a short link |
| `create_qr` | Generate a trackable QR code |
| `list_qr_codes` | List your QR codes |
| `get_qr_stats` | Scan statistics for a QR code |
| `report` | Summary of your account: total links, QR codes, top clicks |

## Setup

### 1. Get your API token

Log in at [frqr.app](https://frqr.app) → **Settings → API** → generate a V2 token (`frqr_pk_...`).

### 2. Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)  
or `%AppData%\Roaming\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "frqr": {
      "command": "npx",
      "args": ["-y", "github:cqev-developpement/frqr-mcp"],
      "env": {
        "FRQR_API_TOKEN": "frqr_pk_your_token_here"
      }
    }
  }
}
```

Restart Claude Desktop. The 🔌 icon confirms the server is connected.

### 3. Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "frqr": {
      "command": "npx",
      "args": ["-y", "github:cqev-developpement/frqr-mcp"],
      "env": {
        "FRQR_API_TOKEN": "frqr_pk_your_token_here"
      }
    }
  }
}
```

### 4. Any MCP client

```bash
FRQR_API_TOKEN=frqr_pk_... npx -y github:cqev-developpement/frqr-mcp
```

## Example prompts

- *"Shorten https://example.com/very/long/path"*
- *"Create a QR code for my portfolio"*
- *"How many clicks did my link 'abc123' get this week?"*
- *"Show me a report of my frqr.app account"*
- *"Disable the link with slug 'old-promo'"*

## Requirements

- Node.js ≥ 18
- A frqr.app account with an API V2 token
