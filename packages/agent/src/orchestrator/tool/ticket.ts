import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { getLinearInstallationByWorkspace } from "@alfred/db/src/repo/linear";
import { LinearClient } from "@linear/sdk";
import { z } from "zod";

const ticketInputSchema = z.object({
  space: z.string().min(1),
  action: z.enum(["create", "update", "comment", "set-delegate", "set-started"]),
  teamId: z.string().optional(),
  issueId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  delegateId: z.string().optional(),
  authz: z.string().optional(),
});

type TicketInput = z.infer<typeof ticketInputSchema>;

async function enforcePolicy(input: TicketInput) {
  await requireToolScopesAndPolicy(input.authz, ["tickets.write"], {
    action: `ticket.${input.action}`,
    resource: {
      kind: "linear",
      id: input.space,
    },
  });
}

function ensure(value: string | undefined, error: string) {
  if (!value || value.trim().length === 0) {
    throw new Error(error);
  }
  return value;
}

function createClient(token: string) {
  return new LinearClient({
    accessToken: token,
  });
}

async function runCreate(client: LinearClient, input: TicketInput) {
  const teamId = ensure(input.teamId, "ticket_team_required");
  const title = ensure(input.title, "ticket_title_required");

  const payload = await client.createIssue({
    teamId,
    title,
    description: input.description ?? undefined,
  });

  if (!payload.success) {
    throw new Error("ticket_create_failed");
  }

  const issue = payload.issue ? await payload.issue : null;

  return {
    ok: true,
    id: payload.issueId ?? issue?.id ?? undefined,
    url: issue?.url ?? undefined,
  };
}

async function runUpdate(client: LinearClient, input: TicketInput) {
  const issueId = ensure(input.issueId, "ticket_issue_required");
  const payload: Record<string, unknown> = {};

  if (input.title) payload.title = input.title;
  if (input.description) payload.description = input.description;

  if (Object.keys(payload).length === 0) {
    throw new Error("ticket_update_payload_empty");
  }

  const response = await client.updateIssue(issueId, payload);
  if (!response.success) {
    throw new Error("ticket_update_failed");
  }

  return { ok: true, id: issueId };
}

async function runComment(client: LinearClient, input: TicketInput) {
  const issueId = ensure(input.issueId, "ticket_issue_required");
  const body = ensure(input.description, "ticket_comment_body_required");

  const payload = await client.createComment({
    issueId,
    body,
  });

  if (!payload.success) {
    throw new Error("ticket_comment_failed");
  }

  const comment = payload.comment ? await payload.comment : null;
  return { ok: true, id: payload.commentId ?? comment?.id ?? undefined };
}

async function runDelegate(client: LinearClient, input: TicketInput, defaultDelegate: string) {
  const issueId = ensure(input.issueId, "ticket_issue_required");
  const delegate = input.delegateId ?? defaultDelegate;

  const response = await client.updateIssue(issueId, {
    assigneeId: delegate,
  });

  if (!response.success) {
    throw new Error("ticket_delegate_failed");
  }

  return { ok: true, id: issueId };
}

async function runSetStarted(client: LinearClient, input: TicketInput) {
  const issueId = ensure(input.issueId, "ticket_issue_required");
  const issue = await client.issue(issueId);
  if (!issue) {
    throw new Error("ticket_issue_not_found");
  }

  const team = await issue.team;
  if (!team) {
    throw new Error("ticket_team_not_found");
  }

  const statesConnection = await team.states();
  const states = statesConnection.nodes ?? [];

  const targetState =
    states.find(state => state.type === "started") ??
    states.find(state => state.name.toLowerCase().includes("progress")) ??
    null;

  if (!targetState) {
    throw new Error("ticket_started_state_missing");
  }

  const response = await client.updateIssue(issueId, {
    stateId: targetState.id,
  });

  if (!response.success) {
    throw new Error("ticket_state_update_failed");
  }

  return { ok: true, id: issueId, stateId: targetState.id };
}

export const toolTicket = {
  name: "ticket",
  description: "Create or update Linear issues with policy enforcement.",
  inputSchema: ticketInputSchema,
  outputSchema: z.object({
    ok: z.boolean(),
    id: z.string().optional(),
    url: z.string().optional(),
    stateId: z.string().optional(),
  }),
  execute: async ({ input }: { input: TicketInput }) => {
    await enforcePolicy(input);

    const installation = await getLinearInstallationByWorkspace(input.space);
    if (!installation) {
      throw new Error("linear_installation_missing");
    }

    const client = createClient(installation.token);

    switch (input.action) {
      case "create":
        return runCreate(client, input);
      case "update":
        return runUpdate(client, input);
      case "comment":
        return runComment(client, input);
      case "set-delegate":
        return runDelegate(client, input, installation.appUser);
      case "set-started":
        return runSetStarted(client, input);
      default:
        throw new Error("ticket_action_not_supported");
    }
  },
};

export type ToolTicket = typeof toolTicket;
