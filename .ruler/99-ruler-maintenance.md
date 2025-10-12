# Ruler Maintenance

1. **Edit sources.** Modify rule markdown under `.ruler/` (or nested `.ruler/` folders). Generated files such as `AGENTS.md`, `.cursor/rules/*`, and `.aider.conf.yml` should never be edited manually.
2. **Apply on demand.** Run `bun run ruler:apply` after changing any rule file. This regenerates agent instructions and updates `.gitignore` entries.
3. **Verify in CI.** The `ruler:verify` script re-applies rules without touching `.gitignore` and fails if the repo becomes dirty. Hook it into GitHub Actions.
4. **Nested rules.** Package/app-specific rules live under `<package>/.ruler/`. They automatically merge with root guidance when Ruler runs with `--nested`.
5. **Adding agents.** Update `.ruler/ruler.toml` to configure new agents or MCP servers. Document the change in this file for future maintainers.
6. **Upgrades.** Periodically bump the Ruler CLI (`bunx @intellectronica/ruler@latest`). Review release notes for breaking changes.
