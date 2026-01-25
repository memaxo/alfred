/**
 * GitHub CLI mock handler
 */

export interface GitHubPR {
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed" | "merged";
  headRef: string;
  baseRef: string;
  url: string;
  additions: number;
  deletions: number;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed";
  url: string;
  labels: string[];
}

export interface GithubConfig {
  prs?: GitHubPR[];
  issues?: GitHubIssue[];
  cliResponses?: Map<string, string>;
}

/**
 * Create a GitHub handler (for CLI-style responses)
 */
export function createGithubHandler(config?: GithubConfig) {
  const prs = new Map<number, GitHubPR>(
    (config?.prs ?? []).map((p) => [p.number, p])
  );
  const issues = new Map<number, GitHubIssue>(
    (config?.issues ?? []).map((i) => [i.number, i])
  );
  const cliResponses = config?.cliResponses ?? new Map();

  return async (
    _req: Request,
    body: Record<string, unknown>
  ): Promise<Response> => {
    const action = body.action as string | undefined;

    // Check for pre-configured CLI response
    if (action && cliResponses.has(action)) {
      return Response.json(JSON.parse(cliResponses.get(action) ?? "{}"));
    }

    switch (action) {
      case "pr-list": {
        return Response.json([...prs.values()]);
      }

      case "pr-view": {
        const number = body.number as number | undefined;
        if (number && prs.has(number)) {
          return Response.json(prs.get(number));
        }
        return Response.json({ error: "pr_not_found" }, { status: 404 });
      }

      case "pr-diff": {
        const number = body.number as number | undefined;
        if (number && prs.has(number)) {
          // Return a mock diff
          return new Response(
            `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 function hello() {
+  console.log("hello");
   return "world";
 }`,
            { headers: { "content-type": "text/plain" } }
          );
        }
        return Response.json({ error: "pr_not_found" }, { status: 404 });
      }

      case "issue-list": {
        return Response.json([...issues.values()]);
      }

      case "issue-view": {
        const number = body.number as number | undefined;
        if (number && issues.has(number)) {
          return Response.json(issues.get(number));
        }
        return Response.json({ error: "issue_not_found" }, { status: 404 });
      }

      case "issue-close": {
        const number = body.number as number | undefined;
        if (number && issues.has(number)) {
          const issue = issues.get(number);
          if (issue) {
            issue.state = "closed";
            return Response.json(issue);
          }
        }
        return Response.json({ error: "issue_not_found" }, { status: 404 });
      }

      default: {
        return Response.json({
          ok: true,
          action,
          timestamp: Date.now(),
        });
      }
    }
  };
}
