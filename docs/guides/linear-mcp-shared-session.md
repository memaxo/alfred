# Linear MCP Shared Session Setup

**Owner:** Infrastructure  
**Last Updated:** 2025-01-27

## Purpose

Configure Linear MCP to use a shared session and credentials across Cursor and Codex, reducing authentication overhead and improving stability.

## Configuration

### 1. Shared Environment Variable

Both Cursor and Codex reference the same environment variable for Linear MCP authentication:

```bash
# Set in your shell profile (~/.zshrc, ~/.bashrc, etc.)
export LINEAR_MCP_TOKEN="your-linear-api-token"
```

Or use the shared `.codex/mcp.env` file (already configured):

```bash
source ~/.codex/mcp.env
```

### 2. Cursor Configuration

Cursor uses HTTP endpoint with environment variable interpolation:

**File:** `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "Linear": {
      "url": "https://mcp.linear.app/mcp",
      "headers": {
        "Authorization": "Bearer ${env:LINEAR_MCP_TOKEN}"
      }
    }
  }
}
```

**Important:** On macOS, GUI apps like Cursor don't inherit shell environment variables. You have two options:

#### Option A: Launch Cursor from Terminal (Recommended)

```bash
# Load environment variables and launch Cursor
source ~/.codex/mcp.env
open -a Cursor
```

Or use the provided launch script:

```bash
~/.cursor/launch-with-env.sh
```

#### Option B: Set Environment Variable in Cursor's Launch Environment

Create a wrapper script or use `launchctl` to set environment variables for GUI apps.

### 3. Codex Configuration

Codex uses TOML config with OAuth support enabled:

**File:** `~/.codex/config.toml`

```toml
[features]
rmcp_client = true  # Enable OAuth support for streamable HTTP MCP servers

[mcp_servers.linear]
url = "https://mcp.linear.app/mcp"
startup_timeout_sec = 30
tool_timeout_sec = 120
```

## Authentication Methods

### Option 1: OAuth Login (Codex Only - Recommended)

Codex supports OAuth login for persistent sessions:

```bash
codex mcp login linear
```

This opens a browser for OAuth authentication and stores credentials securely. The session persists across restarts.

**Note:** Cursor doesn't support OAuth login, so you'll need to use Option 2 (API Token) for Cursor even if Codex uses OAuth.

### Option 2: API Token (Required for Cursor)

Since Cursor doesn't support OAuth login, you need to set up an API token for Cursor to use:

1. **Get Linear API Token:**
   - Go to https://linear.app/settings/api
   - Create a new Personal API Key
   - Copy the token (format: `lin_api_...`)

2. **Set Environment Variable:**
   ```bash
   # Just the token, without "Bearer " prefix
   export LINEAR_MCP_TOKEN="lin_api_..."
   ```

3. **Add to Shell Profile (for persistence):**
   ```bash
   echo 'export LINEAR_MCP_TOKEN="lin_api_..."' >> ~/.zshrc
   source ~/.zshrc
   ```

4. **Or Update `.codex/mcp.env`:**
   ```bash
   export LINEAR_MCP_TOKEN="lin_api_..."
   ```

5. **For Cursor:** Launch Cursor from terminal with environment variables loaded:
   ```bash
   source ~/.codex/mcp.env
   open -a Cursor
   ```

**Note:** 
- Codex can use OAuth (Option 1) OR bearer token (Option 2)
- Cursor requires bearer token (Option 2) since it doesn't support OAuth
- Both tools can use the same `LINEAR_MCP_TOKEN` if you want to share sessions
- Codex automatically adds the "Bearer " prefix via `bearer_token_env_var`. Cursor adds it manually in the config.

## Benefits

- **Shared Session:** Both Cursor and Codex use the same authentication
- **Stability:** HTTP endpoint (`/mcp`) is more stable than SSE (`/sse`)
- **Persistent:** OAuth sessions persist across restarts
- **Single Source:** One environment variable manages both tools

## Troubleshooting

### Codex Failing Quickly / Timeouts

1. **Increase Timeouts:**
   ```toml
   [mcp_servers.linear]
   startup_timeout_sec = 30  # Increase from default 20
   tool_timeout_sec = 120    # Increase from default 60
   ```

2. **Check OAuth Status:**
   ```bash
   codex mcp get linear
   # Should show "Auth: OAuth"
   ```

3. **Re-authenticate if needed:**
   ```bash
   codex mcp logout linear
   codex mcp login linear
   ```

### Cursor Not Connecting

1. **Check Environment Variable:**
   ```bash
   echo $LINEAR_MCP_TOKEN
   ```

2. **Launch Cursor from Terminal:**
   ```bash
   source ~/.codex/mcp.env
   open -a Cursor
   ```

3. **Verify Cursor Config:**
   - Check `~/.cursor/mcp.json` syntax
   - Ensure `${env:LINEAR_MCP_TOKEN}` is correct
   - Restart Cursor after launching from terminal

4. **Check Cursor MCP Logs:**
   - Open Output panel in Cursor (Cmd+Shift+U)
   - Select "MCP Logs" from dropdown
   - Look for Linear connection errors

### MCP Server Not Connecting

1. **Check Environment Variable:**
   ```bash
   echo $LINEAR_MCP_TOKEN
   ```

2. **Verify Cursor Config:**
   - Check `~/.cursor/mcp.json` syntax
   - Ensure `${env:LINEAR_MCP_TOKEN}` is correct

3. **Verify Codex Config:**
   - Check `~/.codex/config.toml` syntax
   - Ensure `rmcp_client = true` is set in `[features]`

4. **Clear OAuth Cache (Codex):**
   ```bash
   rm -rf ~/.mcp-auth
   codex mcp login linear
   ```

### Frequent Restarts

- Use HTTP endpoint (`/mcp`) instead of SSE (`/sse`)
- Use OAuth login instead of bearer token for better session management
- Increase `startup_timeout_sec` and `tool_timeout_sec` if needed

### Token Expired

- Regenerate token at https://linear.app/settings/api
- Update `LINEAR_MCP_TOKEN` environment variable
- Restart Cursor/Codex

## Migration from SSE

If you were previously using SSE (`https://mcp.linear.app/sse`):

1. Update Cursor config to use `/mcp` endpoint
2. Update Codex config to use `/mcp` endpoint
3. Set up OAuth or bearer token authentication
4. Restart both tools

The HTTP endpoint provides better stability and connection management than SSE.
