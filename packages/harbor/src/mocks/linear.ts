/**
 * Linear API mock handler
 */

export interface LinearIssue {
  id: string;
  title: string;
  description?: string;
  state: { id: string; name: string };
  team: { id: string; name: string };
  url: string;
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export interface LinearConfig {
  issues?: LinearIssue[];
  teams?: LinearTeam[];
  autoRespond?: boolean;
}

/**
 * Create a Linear API handler
 */
export function createLinearHandler(config?: LinearConfig) {
  const issues = new Map<string, LinearIssue>(
    (config?.issues ?? []).map((i) => [i.id, i])
  );
  const teams = new Map<string, LinearTeam>(
    (config?.teams ?? []).map((t) => [t.id, t])
  );

  return async (
    _req: Request,
    body: Record<string, unknown>
  ): Promise<Response> => {
    const action = body.action as string | undefined;

    // Handle different action types
    switch (action) {
      case "get-issue": {
        const issueId = body.issueId as string | undefined;
        if (issueId && issues.has(issueId)) {
          return Response.json({ ok: true, issue: issues.get(issueId) });
        }
        return Response.json({ ok: false, error: "issue_not_found" });
      }

      case "list-issues": {
        return Response.json({
          ok: true,
          issues: [...issues.values()],
        });
      }

      case "create-issue": {
        const id = `issue_${Date.now()}`;
        const newIssue: LinearIssue = {
          id,
          title: (body.title as string) ?? "Untitled",
          description: body.description as string | undefined,
          state: { id: "state_todo", name: "Todo" },
          team: { id: body.teamId as string, name: "Team" },
          url: `https://linear.app/team/issue/${id}`,
        };
        issues.set(id, newIssue);
        return Response.json({ ok: true, issue: newIssue });
      }

      case "update-issue": {
        const issueId = body.issueId as string | undefined;
        if (issueId && issues.has(issueId)) {
          const existing = issues.get(issueId);
          if (existing) {
            const updated = { ...existing, ...body };
            issues.set(issueId, updated as LinearIssue);
            return Response.json({ ok: true, issue: updated });
          }
        }
        return Response.json({ ok: false, error: "issue_not_found" });
      }

      case "set-started":
      case "set-completed":
      case "set-cancelled": {
        const issueId = body.issueId as string | undefined;
        const stateMap: Record<string, { id: string; name: string }> = {
          "set-started": { id: "state_started", name: "In Progress" },
          "set-completed": { id: "state_done", name: "Done" },
          "set-cancelled": { id: "state_cancelled", name: "Cancelled" },
        };
        if (issueId && issues.has(issueId)) {
          const existing = issues.get(issueId);
          const newState = stateMap[action];
          if (existing && newState) {
            existing.state = newState;
            return Response.json({
              ok: true,
              stateId: existing.state.id,
              url: existing.url,
            });
          }
        }
        return Response.json({ ok: false, error: "issue_not_found" });
      }

      case "list-teams": {
        return Response.json({
          ok: true,
          teams: [...teams.values()],
        });
      }

      default: {
        // Generic activity response (handles "activity" and unknown actions)
        return Response.json({
          ok: true,
          id: body.issueId ?? body.sessionId ?? `activity_${Date.now()}`,
          url: `https://linear.app/activity/${Date.now()}`,
        });
      }
    }
  };
}
