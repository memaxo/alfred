import crypto from "node:crypto";
import { cacheJTI } from "@alfred/auth/token";
import { getLinearByOAuth, upsertLinear } from "@alfred/db/repo/linear";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";
import {
  type BoardIssue,
  exchangeAuthorizationCode,
  fetchLinearViewer,
  getClientId,
  getRedirectUri,
  getScope,
  type IssueDetail,
  type IssueNode,
  LINEAR_AUTH_BASE,
  linearGraphQL,
  STATE_TTL_SECONDS,
  signState,
  verifyState,
  type WorkflowState,
} from "./linear-helpers";

export const linearRouter = router({
  getAuthorizeUrl: authedProcedure
    .use(requirePolicy("linear.getAuthorizeUrl"))
    .input(
      z
        .object({
          redirectUri: z.string().url().optional(),
        })
        .optional()
    )
    .mutation(({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const redirectUri = input?.redirectUri ?? getRedirectUri();
      const nonce = crypto.randomUUID();
      const state = signState({
        user: session.user.id,
        nonce,
        ts: Date.now(),
      });

      const scope = getScope();
      const url = new URL(LINEAR_AUTH_BASE);
      url.searchParams.set("client_id", getClientId());
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", scope);
      url.searchParams.set("state", state);

      return {
        url: url.toString(),
        state,
        scope,
      };
    }),

  oauthCallback: authedProcedure
    .use(requirePolicy("linear.oauthCallback"))
    .input(
      z.object({
        code: z.string().min(1),
        state: z.string().min(1),
        redirectUri: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const statePayload = verifyState(input.state);
      if (statePayload.user !== session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "linear_state_mismatch",
        });
      }

      const now = Date.now();
      if (now - statePayload.ts > STATE_TTL_SECONDS * 1000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "linear_state_expired",
        });
      }

      // Prevent reuse of the same nonce
      await cacheJTI(`linear:${statePayload.nonce}`, STATE_TTL_SECONDS);

      const redirectUri = input.redirectUri ?? getRedirectUri();
      const token = await exchangeAuthorizationCode(input.code, redirectUri);
      const viewer = await fetchLinearViewer(token.accessToken);

      const viewerId = viewer?.id;
      const organizationId = viewer?.organization?.id;
      if (!(viewerId && organizationId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "linear_viewer_incomplete",
        });
      }

      const expiresAt = token.expiresIn
        ? new Date(Date.now() + token.expiresIn * 1000)
        : null;

      await upsertLinear({
        oauthClient: getClientId(),
        appUser: viewerId,
        space: organizationId,
        token: token.accessToken,
        refresh: token.refreshToken,
        scope: token.scope,
        expires: expiresAt,
        metadata: {
          user: {
            id: viewerId,
            email: viewer?.email ?? null,
            name: viewer?.displayName ?? viewer?.name ?? null,
          },
          organization: {
            id: organizationId,
            name: viewer?.organization?.name ?? null,
          },
        },
      });

      return {
        ok: true as const,
        workspace: organizationId,
        user: viewerId,
        scope: token.scope,
        expiresAt: expiresAt?.toISOString() ?? null,
      };
    }),

  getStatus: authedProcedure
    .use(requirePolicy("linear.getStatus"))
    .query(async ({ ctx }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const clientId = getClientId();
      const installation = await getLinearByOAuth(clientId);

      if (!installation) {
        return { connected: false as const };
      }

      const isExpired = installation.expires
        ? new Date(installation.expires) < new Date()
        : false;

      return {
        connected: true as const,
        workspace: installation.space,
        user: installation.appUser,
        expiresAt: installation.expires?.toISOString() ?? null,
        isExpired,
      };
    }),

  updateIssue: authedProcedure
    .use(requirePolicy("linear.updateIssue"))
    .input(
      z.object({
        issueId: z.string(),
        priority: z.number().optional(),
        stateId: z.string().optional(),
        assigneeId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const clientId = getClientId();
      const installation = await getLinearByOAuth(clientId);

      if (!installation?.token) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "linear_not_connected",
        });
      }

      const result = await linearGraphQL<{
        issueUpdate?: { success: boolean; issue: unknown };
      }>(
        installation.token,
        `mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
          issueUpdate(id: $id, input: $input) {
            success
            issue {
              id
              priority
              state { id name }
              assignee { id name }
            }
          }
        }`,
        {
          id: input.issueId,
          input: {
            priority: input.priority,
            stateId: input.stateId,
            assigneeId: input.assigneeId,
          },
        }
      );

      return result.issueUpdate;
    }),

  // ─────────────────────────────────────────────────────────────────────────
  // Issue List and Board Procedures
  // ─────────────────────────────────────────────────────────────────────────

  issuesList: authedProcedure
    .use(requirePolicy("linear.getStatus"))
    .input(
      z.object({
        teamId: z.string().optional(),
        projectId: z.string().optional(),
        state: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const clientId = getClientId();
      const installation = await getLinearByOAuth(clientId);

      if (!installation?.token) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "linear_not_connected",
        });
      }

      // Build filter
      const filters: string[] = [];
      if (input.teamId) filters.push(`team: { id: { eq: "${input.teamId}" } }`);
      if (input.projectId)
        filters.push(`project: { id: { eq: "${input.projectId}" } }`);
      if (input.state)
        filters.push(`state: { name: { eq: "${input.state}" } }`);

      const filterStr =
        filters.length > 0 ? `filter: { ${filters.join(", ")} }` : "";

      const result = await linearGraphQL<{ issues?: { nodes: IssueNode[] } }>(
        installation.token,
        `query Issues($first: Int!) {
          issues(first: $first ${filterStr}) {
            nodes {
              id identifier title description priority
              state { id name color }
              assignee { id name avatarUrl }
              project { id name }
              team { id name }
              labels { nodes { id name color } }
              createdAt updatedAt
            }
          }
        }`,
        { first: input.limit }
      );

      const issues = (result.issues?.nodes ?? []).map((issue) => ({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        state: issue.state ?? null,
        assignee: issue.assignee ?? null,
        project: issue.project ?? null,
        team: issue.team ?? null,
        labels: issue.labels?.nodes ?? [],
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      }));

      return { issues };
    }),

  issueGet: authedProcedure
    .use(requirePolicy("linear.getStatus"))
    .input(z.object({ issueId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const clientId = getClientId();
      const installation = await getLinearByOAuth(clientId);

      if (!installation?.token) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "linear_not_connected",
        });
      }

      const result = await linearGraphQL<{ issue?: IssueDetail }>(
        installation.token,
        `query Issue($id: String!) {
          issue(id: $id) {
            id identifier title description priority
            state { id name color }
            assignee { id name avatarUrl }
            project { id name }
            team { id name }
            labels { nodes { id name color } }
            comments { nodes { id body user { id name } createdAt } }
            createdAt updatedAt
          }
        }`,
        { id: input.issueId }
      );

      const issue = result.issue;
      if (!issue) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "issue_not_found",
        });
      }

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        state: issue.state ?? null,
        assignee: issue.assignee ?? null,
        project: issue.project ?? null,
        team: issue.team ?? null,
        labels: issue.labels?.nodes ?? [],
        comments: (issue.comments?.nodes ?? []).map((c) => ({
          id: c.id,
          body: c.body,
          author: c.user?.name ?? "Unknown",
          createdAt: c.createdAt,
        })),
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      };
    }),

  boardView: authedProcedure
    .use(requirePolicy("linear.getStatus"))
    .input(z.object({ teamId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      const clientId = getClientId();
      const installation = await getLinearByOAuth(clientId);

      if (!installation?.token) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "linear_not_connected",
        });
      }

      const teamFilter = input.teamId
        ? `team: { id: { eq: "${input.teamId}" } }`
        : "";

      const result = await linearGraphQL<{
        workflowStates?: { nodes: WorkflowState[] };
        issues?: { nodes: BoardIssue[] };
      }>(
        installation.token,
        `query BoardView {
          workflowStates(first: 20) {
            nodes { id name color type position }
          }
          issues(first: 100 ${teamFilter ? `, filter: { ${teamFilter} }` : ""}) {
            nodes {
              id identifier title priority
              state { id }
              assignee { id name avatarUrl }
            }
          }
        }`
      );

      const states = result.workflowStates?.nodes ?? [];
      const issues = result.issues?.nodes ?? [];

      // Group issues by state
      const columns = states
        .sort((a, b) => a.position - b.position)
        .map((state) => ({
          id: state.id,
          name: state.name,
          color: state.color,
          type: state.type,
          issues: issues
            .filter((i) => i.state?.id === state.id)
            .map((i) => ({
              id: i.id,
              identifier: i.identifier,
              title: i.title,
              priority: i.priority,
              assignee: i.assignee ?? null,
            })),
        }));

      return { columns };
    }),
});

export type LinearRouter = typeof linearRouter;
