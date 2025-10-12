# MCP Servers

We expose two default Model Context Protocol servers for all agents:

1. **Filesystem server.** Provides read-only browsing of this repository so assistants can inspect files without bespoke tooling.
2. **Git server.** Enables listing branches, commits, and diffs via MCP. Useful for review tasks and staging-change summaries.

Add new servers by editing `.ruler/ruler.toml`. Prefer official or well-maintained servers, and document usage patterns in this file.
