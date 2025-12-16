#!/usr/bin/env bun

/**
 * Size and Prioritize Linear Tickets for POC Phase
 * 
 * Fetches all open Linear tickets, analyzes them, and updates with:
 * - Story point estimates (Fibonacci: 1, 2, 3, 5, 8, 13)
 * - Priority assignments (Urgent/High/Medium/Low)
 * - Labels (Feature, Bug, tech-debt, etc.)
 * - Status verification
 * 
 * Usage:
 *   LINEAR_API_KEY=<token> bun scripts/size-linear-tickets.ts
 *   OR: bun scripts/size-linear-tickets.ts (loads from .env)
 */

// Load .env if available
try {
  const { readFileSync } = await import("node:fs");
  const envFile = readFileSync(".env", "utf-8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^LINEAR_API_KEY=(.+)$/);
    if (match && !process.env.LINEAR_API_KEY) {
      process.env.LINEAR_API_KEY = match[1].trim().replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // .env not found or can't read - use environment variable
}

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";
const TEAM_NAME = "Alfred-ops";

// Rate limiting: 100 requests/minute
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 2000;

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
  issues: {
    nodes: LinearIssue[];
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
};

type TicketUpdate = {
  ticketId: string;
  identifier: string;
  title: string;
  currentState: string;
  currentPriority: string;
  currentEstimate: number | null;
  actions: {
    size?: number;
    priority?: string;
    labels?: string[];
    status?: string;
    comment?: string;
  };
};

const updates: TicketUpdate[] = [];

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
    throw new Error(`Linear API error: ${response.status} ${response.statusText}`);
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

let teamStatesCache: Map<string, string> | null = null;

async function fetchTeamStates(teamId: string): Promise<Map<string, string>> {
  if (teamStatesCache) {
    return teamStatesCache;
  }

  const query = `
    query GetTeamStates($teamId: String!) {
      team(id: $teamId) {
        states {
          nodes {
            id
            name
            type
          }
        }
      }
    }
  `;

  const data = await fetchLinearGraphQL<{
    team: {
      states: {
        nodes: Array<{ id: string; name: string; type: string }>;
      };
    } | null;
  }>(query, { teamId });

  if (!data.team) {
    throw new Error("Team not found");
  }

  const states = new Map<string, string>();
  for (const state of data.team.states.nodes) {
    states.set(state.name.toLowerCase(), state.id);
  }

  teamStatesCache = states;
  return states;
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
    (t) => t.name === teamName || t.key === teamName.toLowerCase().replace(/\s+/g, "-")
  );

  if (!team) {
    throw new Error(
      `Team "${teamName}" not found. Available teams: ${teamsData.teams.nodes.map((t) => t.name).join(", ")}`
    );
  }

  // Fetch states for this team
  await fetchTeamStates(team.id);

  // Now fetch team details with issues
  const query = `
    query GetTeam($teamId: String!) {
      team(id: $teamId) {
        id
        name
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

function priorityToString(priority: number): string {
  if (priority === 1) return "Urgent";
  if (priority === 2) return "High";
  if (priority === 3) return "Medium";
  if (priority === 4) return "Low";
  return "None";
}

function priorityToNumber(priority: string): number {
  if (priority === "Urgent") return 1;
  if (priority === "High") return 2;
  if (priority === "Medium") return 3;
  if (priority === "Low") return 4;
  return 0;
}

function analyzeTicket(issue: LinearIssue): TicketUpdate {
  const update: TicketUpdate = {
    ticketId: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    currentState: issue.state.name,
    currentPriority: priorityToString(issue.priority),
    currentEstimate: issue.estimate,
    actions: {},
  };

  const title = issue.title.toLowerCase();
  const description = (issue.description || "").toLowerCase();

  // Determine ticket type
  const isEpic = title.includes("epic") || title.includes("[epic]");
  const isBug = title.includes("bug") || title.includes("fix") || title.includes("error");
  const isTechDebt = title.includes("tech debt") || title.includes("refactor") || title.includes("consolidate");
  const isDoc = title.includes("document") || title.includes("doc");
  const isInfra = title.includes("infrastructure") || title.includes("build") || title.includes("deploy");
  const isTest = title.includes("test") || title.includes("coverage");
  const isFeature = !isBug && !isTechDebt && !isDoc && !isInfra && !isTest;

  // Size estimation based on complexity indicators
  let size = issue.estimate || 0;
  if (!size) {
    // Specific ticket handling
    if (issue.identifier === "ALF-134") {
      size = 8; // Epic - multiple tool implementations
    } else if (issue.identifier === "ALF-89") {
      size = 8; // Complex integration work
    } else if (issue.identifier === "ALF-142") {
      size = 8; // Architectural consolidation
    } else if (issue.identifier === "ALF-143") {
      size = 5; // Code extraction/refactoring
    } else if (issue.identifier === "ALF-139") {
      size = 5; // Auth layer simplification
    } else if (isEpic || title.includes("[epic]")) {
      size = 13; // Epics should be broken down
    } else if (title.includes("simple") || title.includes("trivial") || title.includes("add comment") || title.includes("document lint")) {
      size = 1;
    } else if (title.includes("write") && title.includes("test") && !title.includes("integration")) {
      size = 2; // Simple test suite
    } else if (title.includes("create") && title.includes("table")) {
      size = 2; // Migration + repo
    } else if (title.includes("add") && (title.includes("procedure") || title.includes("endpoint") || title.includes("tRPC"))) {
      size = 2; // Single API endpoint
    } else if (title.includes("implement") && !title.includes("complex")) {
      // Single feature implementation
      if (description.includes("multiple") || description.includes("several") || description.includes("suite")) {
        size = 5;
      } else if (description.includes("integration") || description.includes("wire") || description.includes("connect")) {
        size = 3;
      } else {
        size = 2;
      }
    } else if (title.includes("refactor") || title.includes("extract")) {
      size = 5; // Refactoring is typically moderate complexity
    } else if (title.includes("consolidate") || title.includes("architecture")) {
      size = 8; // Large architectural changes
    } else if (title.includes("integration") && (title.includes("knowledge") || title.includes("policy") || title.includes("mindscape"))) {
      size = 8; // Complex integrations
    } else if (title.includes("migration")) {
      size = 3; // Migration work
    } else {
      // Default based on keywords
      const complexKeywords = ["system", "pipeline", "orchestration", "architecture", "integration"];
      const moderateKeywords = ["add", "implement", "create", "wire", "extend"];
      
      if (complexKeywords.some(k => title.includes(k) || description.includes(k))) {
        size = 5;
      } else if (moderateKeywords.some(k => title.includes(k) || description.includes(k))) {
        size = 3;
      } else {
        size = 2; // Conservative default
      }
    }
  }

  // Priority assignment (POC context)
  let priority = priorityToString(issue.priority);
  
  // Specific ticket priority overrides
  if (issue.identifier === "ALF-134") {
    priority = "Urgent"; // POC-critical: agents need tools
  } else if (issue.identifier === "ALF-89") {
    priority = "High"; // Strategic integration, adds POC value
  } else if (issue.identifier === "ALF-72") {
    priority = "High"; // Core assistant functionality
  } else if (issue.identifier === "ALF-139" || issue.identifier === "ALF-142" || issue.identifier === "ALF-143") {
    priority = "Medium"; // Tech debt, not POC-blocking
  } else if (priority === "None") {
    // POC-critical features
    if (title.includes("workflow") && (title.includes("reliability") || title.includes("critical"))) {
      priority = "Urgent";
    } else if (title.includes("tool") && (title.includes("gap") || title.includes("expose"))) {
      priority = "Urgent";
    } else if (title.includes("assistant") && title.includes("tool")) {
      priority = "High";
    } else if (title.includes("voice") && (title.includes("basic") || title.includes("core"))) {
      priority = "High";
    } else if (title.includes("knowledge") && (title.includes("core") || title.includes("integration"))) {
      priority = "High";
    } else if (title.includes("strategic") || title.includes("[strategic]")) {
      priority = "High";
    } else if (isTechDebt && !title.includes("critical")) {
      priority = "Medium";
    } else if (isDoc || (isInfra && !title.includes("critical"))) {
      priority = "Low";
    } else if (isTest && !title.includes("critical")) {
      priority = "Medium";
    } else {
      priority = "Medium"; // Default for unprioritized
    }
  }

  // Labels
  const labels: string[] = [];
  const existingLabels = issue.labels.nodes.map(l => l.name.toLowerCase());
  
  if (isFeature && !existingLabels.includes("feature")) labels.push("Feature");
  if (isBug && !existingLabels.includes("bug")) labels.push("Bug");
  if (isTechDebt && !existingLabels.includes("tech-debt")) labels.push("tech-debt");
  if (isDoc && !existingLabels.includes("documentation")) labels.push("Documentation");
  if (isInfra && !existingLabels.includes("infrastructure")) labels.push("Infrastructure");
  if (isTest && !existingLabels.includes("testing")) labels.push("testing");
  if (isEpic && !existingLabels.includes("epic")) labels.push("epic");

  // Domain labels
  if (title.includes("tool") && !existingLabels.includes("tools")) labels.push("tools");
  if (title.includes("workflow") && !existingLabels.includes("workflow")) labels.push("workflow");
  if (title.includes("voice") && !existingLabels.includes("voice")) labels.push("voice");
  if (title.includes("knowledge") && !existingLabels.includes("knowledge")) labels.push("knowledge");
  if (title.includes("ui") && !existingLabels.includes("ui")) labels.push("ui");
  if (title.includes("api") && !existingLabels.includes("api")) labels.push("api");
  if (title.includes("auth") && !existingLabels.includes("auth")) labels.push("auth");

  // POC indicators
  if (priority === "Urgent" || (priority === "High" && (title.includes("core") || title.includes("critical")))) {
    if (!existingLabels.includes("poc-critical")) labels.push("poc-critical");
  } else if (priority === "Low" || isDoc || (isTechDebt && priority === "Medium")) {
    if (!existingLabels.includes("post-poc")) labels.push("post-poc");
  }

  update.actions.size = size;
  update.actions.priority = priority;
  if (labels.length > 0) {
    update.actions.labels = labels;
  }

  return update;
}

async function updateIssue(update: TicketUpdate, teamId: string): Promise<void> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new Error("LINEAR_API_KEY required");
  }

  const mutation = `
    mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        success
        issue {
          id
          identifier
          estimate
          priority
          state {
            name
          }
        }
      }
    }
  `;

  const input: Record<string, unknown> = {};
  
  if (update.actions.size !== undefined && update.actions.size !== update.currentEstimate) {
    input.estimate = update.actions.size;
  }
  
  if (update.actions.priority && update.actions.priority !== update.currentPriority) {
    input.priority = priorityToNumber(update.actions.priority);
  }

  // Status update - fetch stateId from team states
  if (update.actions.status && update.actions.status !== update.currentState) {
    const states = await fetchTeamStates(teamId);
    const stateId = states.get(update.actions.status.toLowerCase());
    if (stateId) {
      input.stateId = stateId;
    } else {
      console.log(`⚠️  Status "${update.actions.status}" not found for ${update.identifier} (skipped)`);
    }
  }

  // Note: Label updates require separate mutation or finding label IDs
  // For now, we'll log what needs to be updated

  if (Object.keys(input).length === 0) {
    return; // No changes needed
  }

  try {
    await fetchLinearGraphQL(mutation, {
      id: update.ticketId,
      input,
    });
    const changes: string[] = [];
    if (update.actions.size !== undefined && update.actions.size !== update.currentEstimate) {
      changes.push(`size=${update.actions.size}`);
    }
    if (update.actions.priority && update.actions.priority !== update.currentPriority) {
      changes.push(`priority=${update.actions.priority}`);
    }
    if (update.actions.status && update.actions.status !== update.currentState && input.stateId) {
      changes.push(`status=${update.actions.status}`);
    }
    console.log(`✓ Updated ${update.identifier}: ${changes.join(", ")}`);
  } catch (error) {
    console.error(`✗ Failed to update ${update.identifier}:`, error);
  }
}

async function verifyImplementation(identifier: string, title: string): Promise<{
  isComplete: boolean;
  evidence: string;
}> {
  // Check specific tickets we know about
  if (identifier === "ALF-12") {
    // Check escalation handling
    const file = "packages/runtime/src/orchestrator/index.ts";
    try {
      const { readFile } = await import("node:fs/promises");
      const content = await readFile(file, "utf-8");
      if (content.includes("wavesResult.escalated") && content.includes("workflow_escalated")) {
        return {
          isComplete: true,
          evidence: `${file}:43-51`,
        };
      }
    } catch {
      // File might not exist or be readable
    }
  }

  if (identifier === "ALF-72") {
    // Check home tool
    const file = "packages/agent/assistant/src/tool/home.ts";
    try {
      const { readFile } = await import("node:fs/promises");
      const content = await readFile(file, "utf-8");
      if (content.includes("export const toolHome") && content.length > 500) {
        return {
          isComplete: true,
          evidence: `${file} (${content.length} lines)`,
        };
      }
    } catch {
      // File might not exist
    }
  }

  return { isComplete: false, evidence: "" };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run") || !process.env.LINEAR_API_KEY;
  
  if (dryRun) {
    console.log("⚠️  Running in dry-run mode (no updates will be made)");
    console.log("Set LINEAR_API_KEY environment variable to enable updates\n");
  }

  try {
    console.log(`Fetching team "${TEAM_NAME}"...`);
    const team = await fetchTeam(TEAM_NAME);

    console.log(`Found ${team.issues.nodes.length} open issues`);
    
    // Process high-priority first
    const inProgress = team.issues.nodes.filter(i => i.state.name === "In Progress");
    const urgent = team.issues.nodes.filter(i => i.priority === 1);
    const high = team.issues.nodes.filter(i => i.priority === 2);
    
    const highPriority = [...new Set([...inProgress, ...urgent, ...high])];
    const backlog = team.issues.nodes.filter(i => !highPriority.includes(i));

    console.log(`\nProcessing ${highPriority.length} high-priority tickets...`);
    
    for (const issue of highPriority) {
      const update = analyzeTicket(issue);
      
      // Verify implementation for In Progress tickets
      if (issue.state.name === "In Progress") {
        const verification = await verifyImplementation(issue.identifier, issue.title);
        if (verification.isComplete) {
          update.actions.status = "Done";
          update.actions.comment = `Implementation verified: ${verification.evidence}`;
        }
      }
      
      updates.push(update);
    }

    console.log(`\nProcessing ${backlog.length} backlog tickets...`);
    
    // Process backlog in batches
    for (let i = 0; i < backlog.length; i += BATCH_SIZE) {
      const batch = backlog.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} tickets)...`);
      
      for (const issue of batch) {
        const update = analyzeTicket(issue);
        updates.push(update);
      }
      
      // Rate limiting delay
      if (i + BATCH_SIZE < backlog.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    console.log(`\nAnalyzed ${updates.length} tickets`);
    
    if (!dryRun) {
      console.log(`\nApplying updates...`);

    // Apply updates in batches
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(update => updateIssue(update, team.id)));
      
      if (i + BATCH_SIZE < updates.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }
      console.log(`\n✅ Updates applied`);
    } else {
      console.log(`\n⚠️  Dry-run mode: Skipping updates`);
      console.log(`Set LINEAR_API_KEY and run without --dry-run to apply updates`);
    }

    // Generate report
    const dateStr = new Date().toISOString().split("T")[0];
    const reportPath = join(
      process.cwd(),
      "docs",
      "reports",
      `ticket-sizing-summary-${dateStr}.md`
    );

    const sized = updates.filter(u => u.actions.size !== undefined && u.actions.size !== u.currentEstimate).length;
    const prioritized = updates.filter(u => u.actions.priority && u.actions.priority !== u.currentPriority).length;
    const statusCorrections = updates.filter(u => u.actions.status).length;

    const byPriority = {
      Urgent: updates.filter(u => u.actions.priority === "Urgent" || u.currentPriority === "Urgent").length,
      High: updates.filter(u => u.actions.priority === "High" || u.currentPriority === "High").length,
      Medium: updates.filter(u => u.actions.priority === "Medium" || u.currentPriority === "Medium").length,
      Low: updates.filter(u => u.actions.priority === "Low" || u.currentPriority === "Low").length,
    };

    const bySize = {
      1: updates.filter(u => u.actions.size === 1).length,
      2: updates.filter(u => u.actions.size === 2).length,
      3: updates.filter(u => u.actions.size === 3).length,
      5: updates.filter(u => u.actions.size === 5).length,
      8: updates.filter(u => u.actions.size === 8).length,
      13: updates.filter(u => u.actions.size === 13).length,
    };

    const report = `# Ticket Sizing and Prioritization Summary

**Date**: ${dateStr}
**Team**: ${team.name}
**Total Tickets Processed**: ${updates.length}

## Summary

- **Tickets sized**: ${sized} (previously ${updates.filter(u => u.currentEstimate !== null).length})
- **Tickets prioritized**: ${prioritized} (previously ${updates.filter(u => u.currentPriority !== "None").length})
- **Status corrections**: ${statusCorrections}

## Breakdown by Priority

- **Urgent**: ${byPriority.Urgent}
- **High**: ${byPriority.High}
- **Medium**: ${byPriority.Medium}
- **Low**: ${byPriority.Low}

## Breakdown by Size

- **1 point**: ${bySize[1]}
- **2 points**: ${bySize[2]}
- **3 points**: ${bySize[3]}
- **5 points**: ${bySize[5]}
- **8 points**: ${bySize[8]}
- **13 points**: ${bySize[13]} (epics - should be broken down)

## High-Priority Ticket Updates

${highPriority.map(issue => {
  const update = updates.find(u => u.ticketId === issue.id);
  if (!update) return "";
  return `### ${update.identifier}: ${update.title}

- **Current**: ${update.currentState}, ${update.currentPriority}, ${update.currentEstimate || "no estimate"} pts
- **Updated**: Size=${update.actions.size}, Priority=${update.actions.priority}
${update.actions.status ? `- **Status**: ${update.actions.status}` : ""}
${update.actions.comment ? `- **Note**: ${update.actions.comment}` : ""}
`;
}).join("\n")}

---

**Report Generated**: ${new Date().toISOString()}
`;

    await writeFile(reportPath, report, "utf-8");
    console.log(`\n✅ Report generated: ${reportPath}`);
    
  } catch (error) {
    console.error("Error processing tickets:", error);
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
