#!/usr/bin/env bun

/**
 * Generate Repository State Report from Linear Issues
 *
 * Fetches all open Linear issues from Alfred-ops team and generates
 * a structured markdown report documenting ticket status, implementation
 * gaps, and actionable recommendations.
 *
 * Usage:
 *   LINEAR_API_KEY=<token> bun scripts/generate-repo-state-report.ts
 *
 * Or set LINEAR_API_KEY in your environment:
 *   export LINEAR_API_KEY="your-token"
 *   bun scripts/generate-repo-state-report.ts
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";
const TEAM_NAME = "Alfred-ops";

// Open statuses to include
const OPEN_STATUSES = ["Backlog", "Todo", "In Progress", "In Review"];

type LinearIssue = {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  state: {
    id: string;
    name: string;
    type: string;
  };
  priority: number;
  assignee: {
    id: string;
    name: string;
  } | null;
  labels: {
    nodes: Array<{
      id: string;
      name: string;
    }>;
  };
  estimate: number | null;
  createdAt: string;
  updatedAt: string;
  parent: {
    id: string;
    identifier: string;
  } | null;
  children: {
    nodes: Array<{
      id: string;
      identifier: string;
    }>;
  };
};

type LinearTeam = {
  id: string;
  name: string;
  states: {
    nodes: Array<{
      id: string;
      name: string;
      type: string;
    }>;
  };
  issues: {
    nodes: LinearIssue[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
};

async function fetchLinearGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LINEAR_API_KEY environment variable required. Get one from https://linear.app/settings/account/security"
    );
  }

  const response = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(
      `Linear API error: ${response.status} ${response.statusText}`
    );
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string; path?: unknown[] }>;
  };

  if (payload.errors && payload.errors.length > 0) {
    throw new Error(
      `GraphQL errors: ${payload.errors.map((e) => e.message).join(", ")}`
    );
  }

  if (!payload.data) {
    throw new Error("No data returned from Linear API");
  }

  return payload.data;
}

async function fetchTeam(teamName: string): Promise<LinearTeam> {
  // First, get all teams to find the one we want
  const teamsQuery = `
    query GetTeams {
      teams {
        nodes {
          id
          name
          key
        }
      }
    }
  `;

  const teamsData = await fetchLinearGraphQL<{
    teams: { nodes: Array<{ id: string; name: string; key: string }> };
  }>(teamsQuery);

  const team = teamsData.teams.nodes.find(
    (t) =>
      t.name === teamName ||
      t.key === teamName.toLowerCase().replace(/\s+/g, "-")
  );

  if (!team) {
    throw new Error(
      `Team "${teamName}" not found. Available teams: ${teamsData.teams.nodes.map((t) => t.name).join(", ")}`
    );
  }

  // Now fetch team details with issues
  const query = `
    query GetTeam($teamId: String!) {
      team(id: $teamId) {
        id
        name
        states {
          nodes {
            id
            name
            type
          }
        }
        issues(
          first: 250
          filter: {
            state: { type: { nin: ["completed", "canceled"] } }
          }
        ) {
          nodes {
            id
            identifier
            title
            description
            state {
              id
              name
              type
            }
            priority
            assignee {
              id
              name
            }
            labels {
              nodes {
                id
                name
              }
            }
            estimate
            createdAt
            updatedAt
            parent {
              id
              identifier
            }
            children {
              nodes {
                id
                identifier
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `;

  const data = await fetchLinearGraphQL<{ team: LinearTeam | null }>(query, {
    teamId: team.id,
  });

  if (!data.team) {
    throw new Error(`Team "${teamName}" data not found`);
  }

  return data.team;
}

function filterOpenIssues(issues: LinearIssue[]): LinearIssue[] {
  return issues.filter(
    (issue) =>
      OPEN_STATUSES.includes(issue.state.name) &&
      issue.state.type !== "canceled"
  );
}

function categorizeIssues(issues: LinearIssue[]) {
  const byStatus: Record<string, LinearIssue[]> = {};
  const byPriority: Record<string, LinearIssue[]> = {
    Urgent: [],
    High: [],
    Medium: [],
    Low: [],
    None: [],
  };

  for (const issue of issues) {
    // By status
    const status = issue.state.name;
    if (!byStatus[status]) {
      byStatus[status] = [];
    }
    byStatus[status].push(issue);

    // By priority (Linear uses 0-4, where 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low)
    let priorityLabel = "None";
    if (issue.priority === 1) {
      priorityLabel = "Urgent";
    } else if (issue.priority === 2) {
      priorityLabel = "High";
    } else if (issue.priority === 3) {
      priorityLabel = "Medium";
    } else if (issue.priority === 4) {
      priorityLabel = "Low";
    }

    byPriority[priorityLabel].push(issue);
  }

  return { byStatus, byPriority };
}

function findDuplicates(issues: LinearIssue[]): Array<{
  issues: LinearIssue[];
  similarity: string;
}> {
  const duplicates: Array<{ issues: LinearIssue[]; similarity: string }> = [];
  const seen = new Map<string, LinearIssue[]>();

  for (const issue of issues) {
    const titleKey = issue.title.toLowerCase().trim();
    if (!seen.has(titleKey)) {
      seen.set(titleKey, []);
    }
    seen.get(titleKey)?.push(issue);
  }

  for (const [title, matchingIssues] of seen.entries()) {
    if (matchingIssues.length > 1) {
      duplicates.push({
        issues: matchingIssues,
        similarity: `Same title: "${title}"`,
      });
    }
  }

  // Also check for similar descriptions
  const descMap = new Map<string, LinearIssue[]>();
  for (const issue of issues) {
    if (!issue.description) {
      continue;
    }
    const descKey = issue.description.substring(0, 100).toLowerCase().trim();
    if (!descMap.has(descKey)) {
      descMap.set(descKey, []);
    }
    descMap.get(descKey)?.push(issue);
  }

  for (const [desc, matchingIssues] of descMap.entries()) {
    if (matchingIssues.length > 1 && matchingIssues.length <= 3) {
      // Only flag if 2-3 issues share similar description (avoid false positives)
      duplicates.push({
        issues: matchingIssues,
        similarity: `Similar description: "${desc.substring(0, 50)}..."`,
      });
    }
  }

  return duplicates;
}

function calculateTotalEstimate(issues: LinearIssue[]): number {
  return issues.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0);
}

function generateReport(
  team: LinearTeam,
  openIssues: LinearIssue[],
  categories: ReturnType<typeof categorizeIssues>,
  duplicates: ReturnType<typeof findDuplicates>
): string {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timestamp = now.toISOString();

  const totalEstimate = calculateTotalEstimate(openIssues);
  const missingEstimate = openIssues.filter((i) => !i.estimate).length;
  const missingLabels = openIssues.filter((i) => !i.labels.nodes.length).length;
  const missingAssignee = openIssues.filter((i) => !i.assignee).length;

  let report = `# Repository State Report

**Date**: ${dateStr}
**Team**: ${team.name}
**Total Open Issues**: ${openIssues.length}
**Report Generated**: ${timestamp}

## Executive Summary

- **Total open tickets**: ${openIssues.length}
- **By status**: ${Object.entries(categories.byStatus)
    .map(([status, issues]) => `${status} [${issues.length}]`)
    .join(", ")}
- **By priority**: ${Object.entries(categories.byPriority)
    .filter(([, issues]) => issues.length > 0)
    .map(([priority, issues]) => `${priority} [${issues.length}]`)
    .join(", ")}
- **Total estimated effort**: ${totalEstimate} story points
- **Critical findings**: ${duplicates.length} duplicate groups, ${missingEstimate} missing estimates, ${missingLabels} missing labels

`;

  // Critical Findings
  if (duplicates.length > 0) {
    report += `## Critical Findings

### Duplicate Issues

`;
    for (const dup of duplicates) {
      report += `**Issues**: ${dup.issues.map((i) => i.identifier).join(", ")}

**Problem**: ${dup.similarity}

**Evidence**: 
${dup.issues.map((i) => `- ${i.identifier}: "${i.title}"`).join("\n")}

**Recommended Fix**: 
1. Review issues to confirm duplication
2. Close duplicates, keeping the most complete/accurate issue
3. Link duplicates using Linear's duplicate relationship
4. Consolidate any unique information before closing

---

`;
    }
  }

  // Missing Metadata
  const criticalMetadata: string[] = [];
  if (missingEstimate > 0) {
    criticalMetadata.push(
      `- **Missing Estimates**: ${missingEstimate} issues without story point estimates`
    );
  }
  if (missingLabels > 0) {
    criticalMetadata.push(
      `- **Missing Labels**: ${missingLabels} issues without labels`
    );
  }
  if (missingAssignee > 0 && missingAssignee < openIssues.length * 0.5) {
    // Only flag if less than 50% have assignees (single-user system may not use assignees)
    criticalMetadata.push(
      `- **Missing Assignees**: ${missingAssignee} issues without assignees`
    );
  }

  if (criticalMetadata.length > 0) {
    report += `### Missing Metadata

${criticalMetadata.join("\n")}

**Impact**: Cannot accurately estimate effort, filter issues, or track ownership

**Recommended Fix**: 
1. Add estimates using Fibonacci scale (1, 2, 3, 5, 8, 13)
2. Apply appropriate labels (Feature, Bug, tech-debt, etc.)
3. Assign high-priority issues to team members

---

`;
  }

  // Ticket Status Breakdown
  report += `## Ticket Status Breakdown

### By Status

`;
  for (const [status, issues] of Object.entries(categories.byStatus).sort()) {
    report += `#### ${status} (${issues.length})

`;
    for (const issue of issues.slice(0, 20)) {
      // Limit to first 20 per status
      const priorityLabel =
        issue.priority === 1
          ? "Urgent"
          : issue.priority === 2
            ? "High"
            : issue.priority === 3
              ? "Medium"
              : issue.priority === 4
                ? "Low"
                : "None";
      report += `- **${issue.identifier}**: ${issue.title} [${priorityLabel}]${issue.estimate ? ` (${issue.estimate} pts)` : ""}
`;
    }
    if (issues.length > 20) {
      report += `- ... and ${issues.length - 20} more

`;
    }
  }

  report += `### By Priority

`;
  for (const [priority, issues] of Object.entries(categories.byPriority)) {
    if (issues.length === 0) {
      continue;
    }
    report += `#### ${priority} (${issues.length})

`;
    for (const issue of issues.slice(0, 10)) {
      report += `- **${issue.identifier}**: ${issue.title} [${issue.state.name}]${issue.estimate ? ` (${issue.estimate} pts)` : ""}
`;
    }
    if (issues.length > 10) {
      report += `- ... and ${issues.length - 10} more

`;
    }
  }

  // Implementation Verification Note
  report += `## Implementation Verification

**Note**: This report was generated from Linear issue data. To verify implementation status:

1. For each ticket, search codebase for claimed implementations:
   \`\`\`bash
   rg "pattern" --files
   \`\`\`

2. Use \`codebase_search\` for semantic search:
   \`\`\`bash
   codebase_search "How does X work?"
   \`\`\`

3. Verify file paths mentioned in tickets exist:
   \`\`\`bash
   glob_file_search "**/path/to/file.ts"
   \`\`\`

4. Check acceptance criteria against actual code state

**Next Steps**: Run manual verification for high-priority issues to ensure status accuracy.

`;

  // Recommendations
  report += `## Recommendations

### Immediate Actions

1. **Resolve Duplicates**: Review and close ${duplicates.length} duplicate issue groups
2. **Add Missing Estimates**: Add story point estimates to ${missingEstimate} issues
3. **Apply Labels**: Add appropriate labels to ${missingLabels} issues

### Process Improvements

1. **Status Verification Workflow**
   - Before marking issues "Done", verify against codebase
   - Use systematic search (\`rg\`, \`grep\`, \`codebase_search\`) to find implementation
   - Document evidence (file paths, line numbers) in issue comments

2. **Duplicate Detection**
   - Before creating new issues, search for similar titles/descriptions
   - Use Linear's duplicate detection features
   - Close duplicates immediately, don't leave them open

3. **Metadata Completeness**
   - Require estimates for all feature issues
   - Use consistent labels (create label guide)
   - Assign high-priority issues to cycles
   - Add due dates for urgent issues

### Automation Opportunities

1. **Duplicate Detection Script**
   - Create script to detect similar issue titles/descriptions
   - Run weekly to catch duplicates early

2. **File Path Verification**
   - Create script to verify file paths mentioned in issues
   - Flag issues with non-existent paths

3. **Status Sync Automation**
   - Sync ExecPlan status with Linear issues automatically
   - Update Linear when ExecPlan status changes

`;

  // Appendix
  report += `## Appendix: Issue Summary

### Open Issues by Status
${Object.entries(categories.byStatus)
  .map(([status, issues]) => `- ${status}: ${issues.length}`)
  .join("\n")}

### Open Issues by Priority
${Object.entries(categories.byPriority)
  .filter(([, issues]) => issues.length > 0)
  .map(([priority, issues]) => `- ${priority}: ${issues.length}`)
  .join("\n")}

### Metadata Completeness
- Issues with estimates: ${openIssues.length - missingEstimate}/${openIssues.length}
- Issues with labels: ${openIssues.length - missingLabels}/${openIssues.length}
- Issues with assignees: ${openIssues.length - missingAssignee}/${openIssues.length}

---

**Report Generated**: ${timestamp}
**Next Audit Recommended**: ${new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]} (monthly)
`;

  return report;
}

async function main() {
  try {
    console.log(`Fetching team "${TEAM_NAME}"...`);
    const team = await fetchTeam(TEAM_NAME);

    console.log(`Found ${team.issues.nodes.length} total issues`);
    const openIssues = filterOpenIssues(team.issues.nodes);
    console.log(`Filtered to ${openIssues.length} open issues`);

    const categories = categorizeIssues(openIssues);
    const duplicates = findDuplicates(openIssues);

    console.log("Generating report...");
    const report = generateReport(team, openIssues, categories, duplicates);

    const dateStr = new Date().toISOString().split("T")[0];
    const reportPath = join(
      process.cwd(),
      "docs",
      "reports",
      `repo-state-${dateStr}.md`
    );

    await writeFile(reportPath, report, "utf-8");
    console.log(`\n✅ Report generated: ${reportPath}`);
    console.log("\nSummary:");
    console.log(`- Open issues: ${openIssues.length}`);
    console.log(`- Duplicates found: ${duplicates.length}`);
    console.log(
      `- Missing estimates: ${openIssues.filter((i) => !i.estimate).length}`
    );
    console.log(
      `- Missing labels: ${openIssues.filter((i) => !i.labels.nodes.length).length}`
    );
  } catch (error) {
    console.error("Error generating report:", error);
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
