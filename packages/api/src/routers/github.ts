import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

// ─────────────────────────────────────────────────────────────────────────────
// GitHub Router
// ─────────────────────────────────────────────────────────────────────────────

export const githubRouter = router({
  pullRequestsList: authedProcedure
    .input(
      z.object({
        owner: z.string().optional(),
        repo: z.string().optional(),
        state: z.enum(["open", "closed", "all"]).default("open"),
        limit: z.number().int().min(1).max(100).default(30),
      })
    )
    .query(async ({ input }) => {
      try {
        // Use gh CLI to list PRs
        const stateArg =
          input.state === "all" ? "--state=all" : `--state=${input.state}`;
        const args = [
          "pr",
          "list",
          stateArg,
          `--limit=${input.limit}`,
          "--json=number,title,author,state,isDraft,headRefName,baseRefName,additions,deletions,comments,reviewDecision,statusCheckRollup,createdAt,updatedAt,url",
        ];

        if (input.owner && input.repo) {
          args.push(`--repo=${input.owner}/${input.repo}`);
        }

        const proc = Bun.spawn(["gh", ...args], {
          stdout: "pipe",
          stderr: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;

        if (exitCode !== 0) {
          throw new Error(stderr || "gh command failed");
        }

        const rawPRs = JSON.parse(stdout) as Array<{
          number: number;
          title: string;
          author: { login: string };
          state: string;
          isDraft: boolean;
          headRefName: string;
          baseRefName: string;
          additions: number;
          deletions: number;
          comments: Array<unknown>;
          reviewDecision: string | null;
          statusCheckRollup: Array<{ conclusion?: string; status?: string }>;
          createdAt: string;
          updatedAt: string;
          url: string;
        }>;

        const pullRequests = rawPRs.map((pr) => ({
          id: String(pr.number),
          number: pr.number,
          title: pr.title,
          author: pr.author.login,
          status: mapPRState(pr.state),
          isDraft: pr.isDraft,
          isAgentCreated: isAgentAuthor(pr.author.login),
          repository: input.repo ?? "alfred",
          branch: pr.headRefName,
          baseBranch: pr.baseRefName,
          additions: pr.additions,
          deletions: pr.deletions,
          comments: pr.comments.length,
          reviewStatus: mapReviewDecision(pr.reviewDecision),
          ciStatus: mapCIStatus(pr.statusCheckRollup),
          createdAt: pr.createdAt,
          updatedAt: pr.updatedAt,
          url: pr.url,
        }));

        return { pullRequests };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list PRs: ${(error as Error).message}`,
        });
      }
    }),

  pullRequestGet: authedProcedure
    .input(
      z.object({
        owner: z.string().optional(),
        repo: z.string().optional(),
        number: z.number().int().positive(),
      })
    )
    .query(async ({ input }) => {
      try {
        const args = [
          "pr",
          "view",
          String(input.number),
          "--json=number,title,author,state,isDraft,headRefName,baseRefName,additions,deletions,comments,reviewDecision,statusCheckRollup,createdAt,updatedAt,url,body,labels,mergeable,mergedAt,mergedBy,reviewRequests,reviews",
        ];

        if (input.owner && input.repo) {
          args.push(`--repo=${input.owner}/${input.repo}`);
        }

        const proc = Bun.spawn(["gh", ...args], {
          stdout: "pipe",
          stderr: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;

        if (exitCode !== 0) {
          throw new Error(stderr || "gh command failed");
        }

        const pr = JSON.parse(stdout) as {
          number: number;
          title: string;
          author: { login: string };
          state: string;
          isDraft: boolean;
          headRefName: string;
          baseRefName: string;
          additions: number;
          deletions: number;
          comments: Array<{
            body: string;
            author: { login: string };
            createdAt: string;
          }>;
          reviewDecision: string | null;
          statusCheckRollup: Array<{
            name?: string;
            conclusion?: string;
            status?: string;
          }>;
          createdAt: string;
          updatedAt: string;
          url: string;
          body: string;
          labels: Array<{ name: string; color: string }>;
          mergeable: string;
          mergedAt: string | null;
          mergedBy: { login: string } | null;
          reviewRequests: Array<{ login: string }>;
          reviews: Array<{ state: string; author: { login: string } }>;
        };

        return {
          id: String(pr.number),
          number: pr.number,
          title: pr.title,
          author: pr.author.login,
          status: mapPRState(pr.state),
          isDraft: pr.isDraft,
          isAgentCreated: isAgentAuthor(pr.author.login),
          branch: pr.headRefName,
          baseBranch: pr.baseRefName,
          additions: pr.additions,
          deletions: pr.deletions,
          comments: pr.comments.map((c) => ({
            body: c.body,
            author: c.author.login,
            createdAt: c.createdAt,
          })),
          reviewStatus: mapReviewDecision(pr.reviewDecision),
          ciStatus: mapCIStatus(pr.statusCheckRollup),
          ciChecks: pr.statusCheckRollup.map((c) => ({
            name: c.name ?? "unknown",
            conclusion: c.conclusion ?? c.status ?? "pending",
          })),
          createdAt: pr.createdAt,
          updatedAt: pr.updatedAt,
          url: pr.url,
          body: pr.body,
          labels: pr.labels.map((l) => l.name),
          mergeable: pr.mergeable,
          mergedAt: pr.mergedAt,
          mergedBy: pr.mergedBy?.login,
          reviewers: pr.reviewRequests.map((r) => r.login),
          reviews: pr.reviews.map((r) => ({
            state: r.state.toLowerCase(),
            author: r.author.login,
          })),
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get PR: ${(error as Error).message}`,
        });
      }
    }),

  pullRequestDiff: authedProcedure
    .input(
      z.object({
        owner: z.string().optional(),
        repo: z.string().optional(),
        number: z.number().int().positive(),
      })
    )
    .query(async ({ input }) => {
      try {
        const args = ["pr", "diff", String(input.number)];

        if (input.owner && input.repo) {
          args.push(`--repo=${input.owner}/${input.repo}`);
        }

        const proc = Bun.spawn(["gh", ...args], {
          stdout: "pipe",
          stderr: "pipe",
        });

        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;

        if (exitCode !== 0) {
          throw new Error(stderr || "gh command failed");
        }

        // Parse the diff into file chunks
        const files = parseDiff(stdout);

        return { diff: stdout, files };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get PR diff: ${(error as Error).message}`,
        });
      }
    }),

  pullRequestMerge: authedProcedure
    .input(
      z.object({
        owner: z.string().optional(),
        repo: z.string().optional(),
        number: z.number().int().positive(),
        method: z.enum(["merge", "squash", "rebase"]).default("squash"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const args = [
          "pr",
          "merge",
          String(input.number),
          `--${input.method}`,
          "--auto",
        ];

        if (input.owner && input.repo) {
          args.push(`--repo=${input.owner}/${input.repo}`);
        }

        const proc = Bun.spawn(["gh", ...args], {
          stdout: "pipe",
          stderr: "pipe",
        });

        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;

        if (exitCode !== 0) {
          throw new Error(stderr || "gh merge command failed");
        }

        return { merged: true, number: input.number };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to merge PR: ${(error as Error).message}`,
        });
      }
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

function mapPRState(state: string): "open" | "merged" | "closed" {
  if (state === "MERGED") return "merged";
  if (state === "CLOSED") return "closed";
  return "open";
}

function mapReviewDecision(
  decision: string | null
): "pending" | "approved" | "changes_requested" {
  if (decision === "APPROVED") return "approved";
  if (decision === "CHANGES_REQUESTED") return "changes_requested";
  return "pending";
}

function mapCIStatus(
  checks: Array<{ conclusion?: string; status?: string }>
): "pending" | "success" | "failure" | "running" {
  if (checks.length === 0) return "pending";

  const hasFailure = checks.some((c) => c.conclusion === "FAILURE");
  if (hasFailure) return "failure";

  const hasRunning = checks.some(
    (c) => c.status === "IN_PROGRESS" || c.status === "QUEUED"
  );
  if (hasRunning) return "running";

  const allSuccess = checks.every((c) => c.conclusion === "SUCCESS");
  if (allSuccess) return "success";

  return "pending";
}

function isAgentAuthor(author: string): boolean {
  const agentPatterns = [
    "codex",
    "droid",
    "claude",
    "agent",
    "bot",
    "github-actions",
  ];
  return agentPatterns.some((p) => author.toLowerCase().includes(p));
}

type DiffFile = {
  path: string;
  additions: number;
  deletions: number;
  hunks: Array<{
    header: string;
    lines: string[];
  }>;
};

function parseDiff(diffText: string): DiffFile[] {
  const files: DiffFile[] = [];
  const filePattern = /^diff --git a\/(.*) b\/(.*)$/gm;

  let match: RegExpExecArray | null;
  const fileMatches: Array<{ path: string; start: number }> = [];

  while ((match = filePattern.exec(diffText)) !== null) {
    fileMatches.push({
      path: match[2] ?? match[1] ?? "unknown",
      start: match.index,
    });
  }

  for (let i = 0; i < fileMatches.length; i++) {
    const fileMatch = fileMatches[i];
    if (!fileMatch) continue;
    const nextStart = fileMatches[i + 1]?.start ?? diffText.length;
    const fileContent = diffText.slice(fileMatch.start, nextStart);

    const hunks: DiffFile["hunks"] = [];
    let hunkMatch: RegExpExecArray | null;
    const localHunkPattern = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@.*$/gm;
    const hunkStarts: number[] = [];

    while ((hunkMatch = localHunkPattern.exec(fileContent)) !== null) {
      hunkStarts.push(hunkMatch.index);
    }

    for (let j = 0; j < hunkStarts.length; j++) {
      const hunkStart = hunkStarts[j];
      const hunkEnd = hunkStarts[j + 1] ?? fileContent.length;
      if (hunkStart === undefined) continue;
      const hunkContent = fileContent.slice(hunkStart, hunkEnd);
      const lines = hunkContent.split("\n");
      const header = lines[0] ?? "";
      hunks.push({
        header,
        lines: lines.slice(1),
      });
    }

    let additions = 0;
    let deletions = 0;
    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.startsWith("+") && !line.startsWith("+++")) additions++;
        if (line.startsWith("-") && !line.startsWith("---")) deletions++;
      }
    }

    files.push({
      path: fileMatch.path,
      additions,
      deletions,
      hunks,
    });
  }

  return files;
}
