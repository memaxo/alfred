## MCP Integration (Executors)

1. Keep MCP tool exposure minimal per executor; enable only the exact tools needed to avoid context bloat.
2. OpenCode MCP integration must be passed per ACP session (`mcpServers` list); do not rely on user-global config.
3. Droid MCP integration must be configured via per-run isolated `HOME` with `.factory/mcp.json`; never mutate the user’s real home directory.
4. Codex MCP integration must use a per-run `CODEX_HOME` config with `enabled_tools` allowlisting.
