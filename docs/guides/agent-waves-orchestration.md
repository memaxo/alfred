# Agent Waves Orchestration

**Owner:** Infrastructure  
**Last Updated:** 2025-12-15

## Overview

The `scripts/orchestrate-agent-waves.ts` script automates the complete agent workflow: discovering parallelizable Linear tickets, delegating them to Cursor agents, monitoring PR creation, coordinating CodeRabbit reviews, and merging green PRs.

## Workflow Phases

### 1. Discovery

Finds parallelizable Linear tickets:

- Status: "Todo" or "In Progress"
- No parent issues (not subtasks)
- No explicit blockers in description

### 2. Delegation

Assigns tickets to Cursor agents:

- Sets delegate field to Cursor agent ID
- Creates instruction comments using template from `scripts/delegate-linear-tickets.ts`
- Includes scope, key files, patterns, and testing requirements

### 3. Monitoring

Tracks PRs linked to Linear issues:

- Scans open PRs for `ALF-XXX` identifiers in PR body
- Maps PRs to Linear issues
- Tracks draft vs ready status

### 4. Review Coordination

Manages CodeRabbit reviews:

- Marks draft PRs as ready for review
- Waits for CodeRabbit reviews (up to 5 minutes)
- Extracts review summaries (actionable/nitpick counts)
- Creates Linear comments tagging Cursor with feedback

### 5. Merge

Merges green PRs:

- Checks CI status (build-verify, typecheck, tests, e2e)
- Merges PRs with all checks passing
- Updates Linear issue status to "Done"
- Deletes merged branches

## Usage

### Prerequisites

- Linear MCP server configured (`user-Linear`)
- GitHub CLI authenticated (`gh auth login`)
- CodeRabbit bot enabled on repository
- Bun runtime installed

### Basic Commands

```bash
# Delegate tickets
bun scripts/orchestrate-agent-waves.ts delegate --limit 10

# Monitor PRs
bun scripts/orchestrate-agent-waves.ts monitor

# Coordinate reviews
bun scripts/orchestrate-agent-waves.ts review

# Review specific PR
bun scripts/orchestrate-agent-waves.ts review --pr 18

# Merge green PRs (dry-run)
bun scripts/orchestrate-agent-waves.ts merge --dry-run

# Full workflow
bun scripts/orchestrate-agent-waves.ts full --limit 30
```

### Environment Variables

- `LINEAR_TEAM_ID` - Linear team ID (default: "Alfred-ops")
- `GITHUB_REPO` - GitHub repo in format `owner/repo` (default: "memaxo/alfred")

## MCP Integration

The script uses Linear MCP tools for all Linear operations. When running in Cursor's environment, MCP tools are automatically available via `call_mcp_tool`.

### Required MCP Tools

- `list_issues` - Find parallelizable tickets
- `get_issue` - Get issue details by identifier
- `update_issue` - Set delegate and update status
- `create_comment` - Create instruction and review feedback comments

### Standalone Execution

For standalone execution outside Cursor, you have two options:

1. **Use Linear CLI**: Replace MCP calls with `linear` CLI commands
2. **Implement Linear API Client**: Use Linear GraphQL API directly with `LINEAR_API_KEY`

Example Linear CLI integration:

```typescript
// Replace callLinearMCP with:
async function callLinearMCP(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  if (toolName === "list_issues") {
    const result = await Bun.spawn([
      "linear",
      "issue",
      "list",
      "--format",
      "json",
      "--team",
      args.team as string,
      "--state",
      (args.state as string[]).join(","),
    ]).text();
    return JSON.parse(result);
  }
  // ... implement other tools
}
```

## Rate Limiting

The script implements rate limiting to avoid API throttling:

- **Linear API**: 150ms delay between calls
- **Batch processing**: 10 tickets at a time
- **Retry logic**: Exponential backoff (max 3 retries)

## Error Handling

- Linear API failures: Retry with exponential backoff, log errors, continue
- GitHub API failures: Log error, skip PR, continue monitoring
- CodeRabbit timeout: Log warning, proceed without review feedback
- CI failures: Skip merge, log PR number and failure reason

## Monitoring & Observability

The script logs progress for each phase:

```
[DISCOVERY] Finding parallelizable tickets...
[DELEGATE] Processing ticket ALF-122...
[MONITOR] Found 5 PRs linked to Linear issues
[REVIEW] Waiting for CodeRabbit review on PR #18...
[MERGE] Merged PR #18
```

Final summary includes:

- Tickets delegated
- PRs created
- Reviews completed
- PRs merged
- Errors encountered

## Configuration

### Custom Ticket Data

You can provide custom data for tickets by modifying `scripts/delegate-linear-tickets.ts`:

```typescript
export const TICKETS = [
  {
    id: "ALF-XXX",
    scope: "packages/domain/src/",
    keyFiles: "file1.ts, file2.ts",
    keyPatterns: "Pattern description",
    tests: "packages/domain/test/",
  },
];
```

### CI Check Names

Required CI checks are defined in the script:

- `build-verify`
- `typecheck`
- `tests`
- `e2e`

Update `checkCIStatus()` if your CI workflow uses different check names.

## Success Criteria

- Script runs without errors for each phase
- Delegates tickets with proper comments and delegate assignment
- Monitors PRs and extracts Linear issue links correctly
- Marks PRs ready and detects CodeRabbit reviews
- Creates review feedback comments in Linear
- Merges only PRs with all CI checks passing
- Updates Linear issue status appropriately
- Handles rate limits gracefully
- Logs progress and errors with structured output

## Troubleshooting

### MCP Tools Not Available

If running outside Cursor, implement Linear API client or use Linear CLI as shown above.

### CodeRabbit Reviews Not Appearing

- Ensure PRs are marked as ready (not draft)
- Wait up to 5 minutes for CodeRabbit to review
- Check CodeRabbit is enabled on repository
- Verify `.coderabbit.yaml` configuration exists

### CI Checks Not Passing

- Review CI logs: `gh pr checks {pr}`
- Ensure all required checks are configured in `.github/workflows/ci.yml`
- Check for flaky tests or infrastructure issues

### Linear API Rate Limits

- Script implements 150ms delays between calls
- Process tickets in batches of 10
- If hitting limits, increase `RATE_LIMIT_DELAY_MS` constant

## Related Documentation

- `.ruler/24-linear-integration.md` - Linear integration patterns
- `scripts/delegate-linear-tickets.ts` - Ticket delegation template
- `.coderabbit.yaml` - CodeRabbit review configuration
- `.github/workflows/ci.yml` - CI check definitions
