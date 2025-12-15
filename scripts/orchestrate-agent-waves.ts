#!/usr/bin/env bun

/**
 * Orchestrate agent waves: delegate tickets → monitor PRs → coordinate reviews → merge
 * 
 * This script orchestrates the complete agent workflow:
 * 1. Discovery: Find parallelizable Linear tickets
 * 2. Delegation: Assign tickets to Cursor agents with instructions
 * 3. Monitoring: Track PRs linked to Linear issues
 * 4. Review Coordination: Mark PRs ready, wait for CodeRabbit reviews, create feedback comments
 * 5. Merge: Check CI status and merge green PRs, update Linear issues
 * 
 * **Prerequisites:**
 * - Linear MCP server configured (`user-Linear`)
 * - GitHub CLI authenticated (`gh auth login`)
 * - CodeRabbit bot enabled on repository
 * 
 * **Usage:**
 *   bun scripts/orchestrate-agent-waves.ts [command]
 * 
 * **Commands:**
 *   delegate [--limit N]     - Delegate N parallelizable tickets to Cursor agents
 *   monitor                   - Monitor PRs for linked Linear issues
 *   review [--pr N]          - Mark PRs ready and coordinate CodeRabbit reviews
 *   merge [--dry-run]        - Merge green PRs and update Linear issues
 *   full [--limit N] [--dry-run] - Run complete workflow
 * 
 * **Environment Variables:**
 *   LINEAR_TEAM_ID           - Linear team ID (default: "Alfred-ops")
 *   GITHUB_REPO              - GitHub repo in format owner/repo (default: "memaxo/alfred")
 * 
 * **Examples:**
 *   # Delegate 10 tickets
 *   bun scripts/orchestrate-agent-waves.ts delegate --limit 10
 * 
 *   # Monitor all PRs
 *   bun scripts/orchestrate-agent-waves.ts monitor
 * 
 *   # Review specific PR
 *   bun scripts/orchestrate-agent-waves.ts review --pr 18
 * 
 *   # Dry-run merge (check what would be merged)
 *   bun scripts/orchestrate-agent-waves.ts merge --dry-run
 * 
 *   # Full workflow with 30 tickets
 *   bun scripts/orchestrate-agent-waves.ts full --limit 30
 * 
 * **Note:** This script requires MCP access to Linear. When run in Cursor environment,
 * MCP tools are automatically available. For standalone execution, implement Linear
 * API client or use Linear CLI as alternative.
 */

import { generateCommentTemplate } from "./delegate-linear-tickets.ts";

// Configuration
const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID || "Alfred-ops";
const GITHUB_REPO = process.env.GITHUB_REPO || "memaxo/alfred";
const CURSOR_DELEGATE_ID = "5497cebb-b66c-4675-bd54-fc650cf94d27";
const RATE_LIMIT_DELAY_MS = 150;
const BATCH_SIZE = 10;
const CODE_RABBIT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const CODE_RABBIT_POLL_INTERVAL_MS = 30 * 1000; // 30 seconds

// Types
interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string;
  status: string;
  parentId?: string | null;
}

interface PRWithLinear {
  pr: number;
  linearId: string;
  linearIssueId: string;
  isDraft: boolean;
  title: string;
  url: string;
}

interface CodeRabbitReview {
  actionable: number;
  nitpicks: number;
  body: string;
  submittedAt: string;
}

interface CIStatus {
  mergeable: boolean;
  checks: {
    name: string;
    status: "completed" | "pending" | "failed";
    conclusion: "success" | "failure" | "neutral" | null;
  }[];
}

interface TicketCustomData {
  scope?: string;
  keyFiles?: string;
  keyPatterns?: string;
  tests?: string;
}

interface WorkflowStats {
  delegated: number;
  prsCreated: number;
  reviewsCompleted: number;
  merged: number;
  errors: string[];
}

// Utility: Rate limiting delay
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Utility: Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delayMs = baseDelay * Math.pow(2, attempt);
        console.log(`[RETRY] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`);
        await delay(delayMs);
      }
    }
  }
  throw lastError || new Error("Retry failed");
}

// Utility: Call Linear MCP tool
// NOTE: This script is designed to run in Cursor's environment where MCP tools are available.
// When run via Cursor agent or in MCP-enabled context, use call_mcp_tool directly.
// For standalone execution, you would need to implement Linear API client or use Linear CLI.
async function callLinearMCP(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  // In Cursor environment with MCP access:
  // return await call_mcp_tool({ server: "user-Linear", toolName, arguments: args });
  
  // For standalone execution, you could:
  // 1. Use Linear GraphQL API directly with LINEAR_API_KEY
  // 2. Use linear CLI: `linear issue list --format json`
  // 3. Implement a Linear client wrapper
  
  // Placeholder implementation - replace with actual MCP call or API client
  throw new Error(
    `Linear MCP integration required. This script must run in Cursor environment with MCP access, or implement Linear API client.\n` +
    `Would call: ${toolName} with args: ${JSON.stringify(args)}`
  );
}

// Phase 1: Discovery
async function findParallelizableTickets(limit = 30): Promise<LinearIssue[]> {
  console.log(`[DISCOVERY] Finding parallelizable tickets (limit: ${limit})...`);

  try {
    // Use Linear MCP list_issues
    const issues = (await callLinearMCP("list_issues", {
      team: LINEAR_TEAM_ID,
      state: ["Todo", "In Progress"],
      limit: 100,
    })) as LinearIssue[];

    // Filter out subtasks and tickets with blockers
    const parallelizable = issues
      .filter((issue) => {
        // Skip subtasks
        if (issue.parentId) {
          return false;
        }

        // Check for explicit blockers in description
        const description = issue.description || "";
        const hasBlocker =
          description.includes("blocks:") ||
          description.includes("depends on:") ||
          description.includes("blocked by:");

        return !hasBlocker;
      })
      .slice(0, limit);

    console.log(
      `[DISCOVERY] Found ${parallelizable.length} parallelizable tickets`
    );
    return parallelizable;
  } catch (error) {
    console.error(`[DISCOVERY] Error finding tickets:`, error);
    throw error;
  }
}

// Phase 2: Delegation
async function delegateTicket(
  issue: LinearIssue,
  customData?: TicketCustomData
): Promise<void> {
  console.log(`[DELEGATE] Processing ticket ${issue.identifier}...`);

  try {
    // Set delegate
    await retryWithBackoff(async () => {
      await callLinearMCP("update_issue", {
        issueId: issue.id,
        delegate: CURSOR_DELEGATE_ID,
      });
    });

    // Generate comment template
    const commentBody = generateCommentTemplate({
      title: issue.title,
      description: issue.description || "",
      scope: customData?.scope,
      keyFiles: customData?.keyFiles,
      keyPatterns: customData?.keyPatterns,
      tests: customData?.tests,
    });

    // Create comment
    await retryWithBackoff(async () => {
      await callLinearMCP("create_comment", {
        issueId: issue.id,
        body: commentBody,
      });
    });

    console.log(`[DELEGATE] ✅ Delegated ${issue.identifier}`);
  } catch (error) {
    console.error(`[DELEGATE] ❌ Failed to delegate ${issue.identifier}:`, error);
    throw error;
  }
}

async function delegateTickets(
  tickets: LinearIssue[],
  customDataMap?: Map<string, TicketCustomData>
): Promise<WorkflowStats> {
  console.log(`[DELEGATE] Delegating ${tickets.length} tickets...`);

  const stats: WorkflowStats = {
    delegated: 0,
    prsCreated: 0,
    reviewsCompleted: 0,
    merged: 0,
    errors: [],
  };

  // Process in batches
  for (let i = 0; i < tickets.length; i += BATCH_SIZE) {
    const batch = tickets.slice(i, i + BATCH_SIZE);
    console.log(`[DELEGATE] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}...`);

    for (const ticket of batch) {
      try {
        const customData = customDataMap?.get(ticket.identifier);
        await delegateTicket(ticket, customData);
        stats.delegated++;
        await delay(RATE_LIMIT_DELAY_MS);
      } catch (error) {
        const errorMsg = `Failed to delegate ${ticket.identifier}: ${error}`;
        console.error(`[DELEGATE] ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < tickets.length) {
      await delay(RATE_LIMIT_DELAY_MS * 2);
    }
  }

  console.log(`[DELEGATE] Completed: ${stats.delegated}/${tickets.length} delegated`);
  return stats;
}

// Phase 3: Monitoring
async function monitorPRs(): Promise<PRWithLinear[]> {
  console.log(`[MONITOR] Monitoring PRs for Linear issue links...`);

  try {
    // Get all open PRs
    const prListOutput = await Bun.spawn([
      "gh",
      "pr",
      "list",
      "--state",
      "open",
      "--json",
      "number,title,body,isDraft,url",
    ]).text();

    const prs = JSON.parse(prListOutput) as Array<{
      number: number;
      title: string;
      body: string;
      isDraft: boolean;
      url: string;
    }>;

    // Extract Linear issue IDs
    const prsWithLinear: PRWithLinear[] = [];

    for (const pr of prs) {
      const linearMatch = pr.body?.match(/ALF-\d+/);
      if (linearMatch) {
        const linearId = linearMatch[0];

        // Get Linear issue ID from identifier
        try {
          const issue = (await callLinearMCP("get_issue", {
            id: linearId,
          })) as LinearIssue;

          prsWithLinear.push({
            pr: pr.number,
            linearId,
            linearIssueId: issue.id,
            isDraft: pr.isDraft,
            title: pr.title,
            url: pr.url,
          });
        } catch (error) {
          console.warn(
            `[MONITOR] Could not resolve Linear issue ${linearId} for PR #${pr.number}:`,
            error
          );
        }

        await delay(RATE_LIMIT_DELAY_MS);
      }
    }

    console.log(`[MONITOR] Found ${prsWithLinear.length} PRs linked to Linear issues`);
    return prsWithLinear;
  } catch (error) {
    console.error(`[MONITOR] Error monitoring PRs:`, error);
    throw error;
  }
}

// Phase 4: Review Coordination
async function markPRsReady(prs: number[]): Promise<void> {
  console.log(`[REVIEW] Marking ${prs.length} draft PRs as ready...`);

  for (const pr of prs) {
    try {
      await Bun.spawn(["gh", "pr", "ready", String(pr)]).exited;
      console.log(`[REVIEW] ✅ Marked PR #${pr} as ready`);
      await delay(RATE_LIMIT_DELAY_MS);
    } catch (error) {
      console.error(`[REVIEW] ❌ Failed to mark PR #${pr} ready:`, error);
    }
  }
}

async function getCodeRabbitReview(pr: number): Promise<CodeRabbitReview | null> {
  try {
    const reviewsOutput = await Bun.spawn([
      "gh",
      "api",
      `repos/${GITHUB_REPO}/pulls/${pr}/reviews`,
      "--jq",
      '.[] | select(.user.login == "coderabbitai[bot]")',
    ]).text();

    const reviews = JSON.parse(reviewsOutput) as Array<{
      body: string;
      submitted_at: string;
    }>;

    if (reviews.length === 0) {
      return null;
    }

    const review = reviews[0];
    const body = review.body;

    // Extract actionable and nitpick counts
    const actionableMatch = body.match(/Actionable comments posted: (\d+)/);
    const nitpickMatch = body.match(/Nitpick comments \((\d+)\)/);

    return {
      actionable: actionableMatch ? parseInt(actionableMatch[1], 10) : 0,
      nitpicks: nitpickMatch ? parseInt(nitpickMatch[1], 10) : 0,
      body,
      submittedAt: review.submitted_at,
    };
  } catch (error) {
    console.error(`[REVIEW] Error getting CodeRabbit review for PR #${pr}:`, error);
    return null;
  }
}

async function waitForCodeRabbitReview(
  pr: number,
  timeoutMs = CODE_RABBIT_TIMEOUT_MS
): Promise<CodeRabbitReview | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const review = await getCodeRabbitReview(pr);
    if (review) {
      return review;
    }

    console.log(`[REVIEW] Waiting for CodeRabbit review on PR #${pr}...`);
    await delay(CODE_RABBIT_POLL_INTERVAL_MS);
  }

  console.warn(`[REVIEW] ⚠️ Timeout waiting for CodeRabbit review on PR #${pr}`);
  return null;
}

async function createReviewComment(
  pr: number,
  linearIssueId: string,
  review: CodeRabbitReview
): Promise<void> {
  console.log(`[REVIEW] Creating review comment for Linear issue ${linearIssueId}...`);

  // Extract key feedback areas from review body
  const feedbackAreas: string[] = [];
  const lines = review.body.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.includes("**Actionable") ||
      line.includes("**Key Feedback") ||
      line.includes("Consider") ||
      line.includes("LGTM")
    ) {
      // Extract context around feedback
      const context = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 5)).join("\n");
      if (context.length < 500) {
        feedbackAreas.push(context);
      }
    }
  }

  const commentBody = `@Cursor CodeRabbit has completed review of PR #${pr}. Please address the feedback:

**Review Summary:**
- **Actionable comments:** ${review.actionable}
- **Nitpick comments:** ${review.nitpicks}

${feedbackAreas.length > 0 ? `**Key Feedback Areas:**\n${feedbackAreas.slice(0, 3).join("\n\n")}\n\n` : ""}**Next Steps:**
1. Review CodeRabbit comments on PR #${pr}: https://github.com/${GITHUB_REPO}/pull/${pr}
2. Address ${review.actionable > 0 ? "actionable " : ""}feedback${review.nitpicks > 0 ? " and nitpick suggestions" : ""}
3. Update PR with fixes
4. Mark review as complete once addressed

${review.actionable === 0 && review.nitpicks === 0 ? "CodeRabbit review is generally positive with minor suggestions." : ""}`;

  try {
    await retryWithBackoff(async () => {
      await callLinearMCP("create_comment", {
        issueId: linearIssueId,
        body: commentBody,
      });
    });

    console.log(`[REVIEW] ✅ Created review comment for Linear issue`);
  } catch (error) {
    console.error(`[REVIEW] ❌ Failed to create review comment:`, error);
    throw error;
  }
}

async function coordinateReviews(
  prs: PRWithLinear[],
  markReady = true
): Promise<WorkflowStats> {
  console.log(`[REVIEW] Coordinating CodeRabbit reviews for ${prs.length} PRs...`);

  const stats: WorkflowStats = {
    delegated: 0,
    prsCreated: prs.length,
    reviewsCompleted: 0,
    merged: 0,
    errors: [],
  };

  // Mark draft PRs as ready
  if (markReady) {
    const draftPRs = prs.filter((p) => p.isDraft).map((p) => p.pr);
    if (draftPRs.length > 0) {
      await markPRsReady(draftPRs);
    }
  }

  // Wait for CodeRabbit reviews
  for (const prInfo of prs) {
    try {
      const review = await waitForCodeRabbitReview(prInfo.pr);
      if (review) {
        await createReviewComment(prInfo.pr, prInfo.linearIssueId, review);
        stats.reviewsCompleted++;
        await delay(RATE_LIMIT_DELAY_MS);
      } else {
        stats.errors.push(`No CodeRabbit review for PR #${prInfo.pr} within timeout`);
      }
    } catch (error) {
      const errorMsg = `Failed to coordinate review for PR #${prInfo.pr}: ${error}`;
      console.error(`[REVIEW] ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
  }

  console.log(
    `[REVIEW] Completed: ${stats.reviewsCompleted}/${prs.length} reviews coordinated`
  );
  return stats;
}

// Phase 5: Merge
async function checkCIStatus(pr: number): Promise<CIStatus> {
  try {
    const prDataOutput = await Bun.spawn([
      "gh",
      "api",
      `repos/${GITHUB_REPO}/pulls/${pr}`,
      "--jq",
      '{mergeable, statusesCheckRollup: .statusesCheckRollup}',
    ]).text();

    const prData = JSON.parse(prDataOutput) as {
      mergeable: boolean;
      statusesCheckRollup: Array<{
        name: string;
        status: "completed" | "pending" | "failed";
        conclusion: "success" | "failure" | "neutral" | null;
      }>;
    };

    // Required checks from CI workflow
    const requiredChecks = ["build-verify", "typecheck", "tests", "e2e"];

    const checks = prData.statusesCheckRollup.map((check) => ({
      name: check.name,
      status: check.status,
      conclusion: check.conclusion,
    }));

    // Check if all required checks passed
    const allChecksPassed = requiredChecks.every((required) => {
      const check = checks.find((c) => c.name.includes(required));
      return check?.status === "completed" && check?.conclusion === "success";
    });

    return {
      mergeable: prData.mergeable && allChecksPassed,
      checks,
    };
  } catch (error) {
    console.error(`[MERGE] Error checking CI status for PR #${pr}:`, error);
    return {
      mergeable: false,
      checks: [],
    };
  }
}

async function mergeGreenPRs(
  prs: PRWithLinear[],
  dryRun = false
): Promise<WorkflowStats> {
  console.log(`[MERGE] Checking ${prs.length} PRs for merge eligibility...`);

  const stats: WorkflowStats = {
    delegated: 0,
    prsCreated: prs.length,
    reviewsCompleted: 0,
    merged: 0,
    errors: [],
  };

  for (const prInfo of prs) {
    try {
      const ciStatus = await checkCIStatus(prInfo.pr);

      if (!ciStatus.mergeable) {
        const failedChecks = ciStatus.checks.filter(
          (c) => c.status !== "completed" || c.conclusion !== "success"
        );
        console.log(
          `[MERGE] ⏭️ Skipping PR #${prInfo.pr}: CI checks not passing (${failedChecks.length} failed)`
        );
        stats.errors.push(`PR #${prInfo.pr}: CI checks not passing`);
        continue;
      }

      if (dryRun) {
        console.log(`[MERGE] [DRY-RUN] Would merge PR #${prInfo.pr}`);
        stats.merged++;
        continue;
      }

      // Merge PR
      await Bun.spawn([
        "gh",
        "pr",
        "merge",
        String(prInfo.pr),
        "--squash",
        "--delete-branch",
      ]).exited;

      console.log(`[MERGE] ✅ Merged PR #${prInfo.pr}`);

      // Update Linear issue status
      try {
        await retryWithBackoff(async () => {
          await callLinearMCP("update_issue", {
            issueId: prInfo.linearIssueId,
            status: "Done",
          });
        });
        console.log(`[MERGE] ✅ Updated Linear issue ${prInfo.linearId} to Done`);
      } catch (error) {
        console.warn(
          `[MERGE] ⚠️ Failed to update Linear issue ${prInfo.linearId}:`,
          error
        );
      }

      stats.merged++;
      await delay(RATE_LIMIT_DELAY_MS);
    } catch (error) {
      const errorMsg = `Failed to merge PR #${prInfo.pr}: ${error}`;
      console.error(`[MERGE] ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
  }

  console.log(`[MERGE] Completed: ${stats.merged}/${prs.length} PRs merged`);
  return stats;
}

// Main workflow
async function runFullWorkflow(limit = 30, dryRun = false): Promise<void> {
  console.log(`[WORKFLOW] Starting full agent wave workflow (limit: ${limit}, dry-run: ${dryRun})...`);

  const overallStats: WorkflowStats = {
    delegated: 0,
    prsCreated: 0,
    reviewsCompleted: 0,
    merged: 0,
    errors: [],
  };

  try {
    // Phase 1: Discovery
    const tickets = await findParallelizableTickets(limit);

    // Phase 2: Delegation
    const delegateStats = await delegateTickets(tickets);
    overallStats.delegated = delegateStats.delegated;
    overallStats.errors.push(...delegateStats.errors);

    // Phase 3: Monitoring
    const prs = await monitorPRs();
    overallStats.prsCreated = prs.length;

    // Phase 4: Review Coordination
    const reviewStats = await coordinateReviews(prs);
    overallStats.reviewsCompleted = reviewStats.reviewsCompleted;
    overallStats.errors.push(...reviewStats.errors);

    // Phase 5: Merge
    const mergeStats = await mergeGreenPRs(prs, dryRun);
    overallStats.merged = mergeStats.merged;
    overallStats.errors.push(...mergeStats.errors);

    // Summary
    console.log("\n[WORKFLOW] ===== SUMMARY =====");
    console.log(`Delegated: ${overallStats.delegated}`);
    console.log(`PRs Created: ${overallStats.prsCreated}`);
    console.log(`Reviews Completed: ${overallStats.reviewsCompleted}`);
    console.log(`Merged: ${overallStats.merged}`);
    if (overallStats.errors.length > 0) {
      console.log(`\nErrors (${overallStats.errors.length}):`);
      overallStats.errors.forEach((err) => console.log(`  - ${err}`));
    }
  } catch (error) {
    console.error(`[WORKFLOW] Fatal error:`, error);
    process.exit(1);
  }
}

// CLI
const command = process.argv[2];
const args = process.argv.slice(3);

if (command === "delegate") {
  const limit = args.includes("--limit")
    ? parseInt(args[args.indexOf("--limit") + 1], 10)
    : 30;
  findParallelizableTickets(limit)
    .then((tickets) => delegateTickets(tickets))
    .then((stats) => {
      console.log(`Delegated: ${stats.delegated}`);
      if (stats.errors.length > 0) {
        console.log(`Errors: ${stats.errors.length}`);
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
} else if (command === "monitor") {
  monitorPRs()
    .then((prs) => {
      console.log(`Found ${prs.length} PRs linked to Linear issues:`);
      prs.forEach((p) =>
        console.log(`  PR #${p.pr}: ${p.linearId} (${p.isDraft ? "draft" : "ready"})`)
      );
    })
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
} else if (command === "review") {
  const prArg = args.find((a) => a.startsWith("--pr"));
  const prNumber = prArg ? parseInt(prArg.split("=")[1] || prArg.split(" ")[1], 10) : null;

  if (prNumber) {
    // Review specific PR
    monitorPRs()
      .then((prs) => {
        const pr = prs.find((p) => p.pr === prNumber);
        if (!pr) {
          console.error(`PR #${prNumber} not found or not linked to Linear issue`);
          process.exit(1);
        }
        return coordinateReviews([pr], false);
      })
      .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
      });
  } else {
    // Review all PRs
    monitorPRs()
      .then((prs) => coordinateReviews(prs))
      .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
      });
  }
} else if (command === "merge") {
  const dryRun = args.includes("--dry-run");
  monitorPRs()
    .then((prs) => mergeGreenPRs(prs, dryRun))
    .then((stats) => {
      console.log(`Merged: ${stats.merged}`);
      if (stats.errors.length > 0) {
        console.log(`Errors: ${stats.errors.length}`);
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
} else if (command === "full") {
  const limit = args.includes("--limit")
    ? parseInt(args[args.indexOf("--limit") + 1], 10)
    : 30;
  const dryRun = args.includes("--dry-run");
  runFullWorkflow(limit, dryRun).catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
} else {
  console.log(`
Usage: bun scripts/orchestrate-agent-waves.ts [command]

Commands:
  delegate [--limit N]     - Delegate N parallelizable tickets to Cursor agents
  monitor [--watch]        - Monitor PRs for linked Linear issues
  review [--pr N]          - Mark PRs ready and coordinate CodeRabbit reviews
  merge [--dry-run]        - Merge green PRs and update Linear issues
  full [--limit N] [--dry-run] - Run complete workflow

Examples:
  bun scripts/orchestrate-agent-waves.ts delegate --limit 10
  bun scripts/orchestrate-agent-waves.ts monitor
  bun scripts/orchestrate-agent-waves.ts review --pr 18
  bun scripts/orchestrate-agent-waves.ts merge --dry-run
  bun scripts/orchestrate-agent-waves.ts full --limit 30
`);
  process.exit(1);
}
