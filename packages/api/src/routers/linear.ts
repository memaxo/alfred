import { cacheJTI } from "@alfred/auth/token";
import { linearRepo } from "@alfred/db";

const { upsertLinear, getLinearByOAuth } = linearRepo;

import crypto from "node:crypto";
import { URLSearchParams } from "node:url";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { requirePolicy } from "../gate";
import { authedProcedure, router } from "../trpc";
import { logger } from "../utils/logger";

const LINEAR_AUTH_BASE = "https://linear.app/oauth/authorize";
const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";
const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";
const DEFAULT_SCOPE = "read write";
const STATE_TTL_SECONDS = 10 * 60; // 10 minutes

interface SignedStatePayload {
  user: string;
  nonce: string;
  ts: number;
}

function getClientId(): string {
  const value = process.env.LINEAR_CLIENT_ID;
  if (!value) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "linear_client_id_missing",
    });
  }
  return value;
}

function getClientSecret(): string {
  const value = process.env.LINEAR_CLIENT_SECRET;
  if (!value) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "linear_client_secret_missing",
    });
  }
  return value;
}

function getRedirectUri(): string {
  const value = process.env.LINEAR_REDIRECT_URI;
  if (!value) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "linear_redirect_uri_missing",
    });
  }
  return value;
}

function getScope(): string {
  return process.env.LINEAR_SCOPE?.trim() || DEFAULT_SCOPE;
}

function getStateSigningKey(): string {
  return process.env.LINEAR_STATE_SECRET?.trim() || getClientSecret();
}

function signState(payload: SignedStatePayload): string {
  const raw = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getStateSigningKey())
    .update(raw)
    .digest("base64url");
  return `${raw}.${signature}`;
}

function verifyState(state: string): SignedStatePayload {
  const [raw, signature] = state.split(".");
  if (!(raw && signature)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "linear_state_invalid",
    });
  }

  const expected = crypto
    .createHmac("sha256", getStateSigningKey())
    .update(raw)
    .digest("base64url");
  const provided = Buffer.from(signature, "base64url");
  const computed = Buffer.from(expected, "base64url");
  if (
    provided.length !== computed.length ||
    !crypto.timingSafeEqual(provided, computed)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "linear_state_invalid",
    });
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8")
    ) as Partial<SignedStatePayload>;
    if (
      !decoded ||
      typeof decoded.user !== "string" ||
      typeof decoded.nonce !== "string" ||
      typeof decoded.ts !== "number"
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "invalid_state_payload",
      });
    }
    return decoded as SignedStatePayload;
  } catch (error) {
    // State parsing failed - log and throw TRPCError
    logger.warn("linear_state_parse_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "linear_state_invalid",
    });
  }
}

async function exchangeAuthorizationCode(code: string, redirectUri: string) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: getClientId(),
    client_secret: getClientSecret(),
  });

  const response = await fetch(LINEAR_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "linear_token_exchange_failed",
    });
  }

  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    expires_in?: number;
    error?: string;
  };

  if (!json.access_token) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: json.error ?? "linear_token_missing",
    });
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    scope: json.scope ?? getScope(),
    expiresIn:
      typeof json.expires_in === "number" && Number.isFinite(json.expires_in)
        ? json.expires_in
        : null,
  };
}

interface LinearViewerPayload {
  viewer?: {
    id?: string;
    email?: string | null;
    displayName?: string | null;
    name?: string | null;
    organization?: {
      id?: string;
      name?: string | null;
    } | null;
  };
}

async function fetchLinearViewer(
  accessToken: string
): Promise<LinearViewerPayload["viewer"]> {
  const response = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      query: `query ViewerInfo {
        viewer {
          id
          email
          displayName
          name
          organization {
            id
            name
          }
        }
      }`,
    }),
  });

  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "linear_viewer_fetch_failed",
    });
  }

  const payload = (await response.json()) as {
    data?: LinearViewerPayload;
    errors?: unknown;
  };
  if (
    payload.errors &&
    Array.isArray(payload.errors) &&
    payload.errors.length > 0
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "linear_viewer_fetch_failed",
    });
  }

  return payload.data?.viewer;
}

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
    .mutation(async ({ ctx, input }) => {
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

      if (!installation || !installation.token) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "linear_not_connected",
        });
      }

      const response = await fetch(LINEAR_GRAPHQL_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${installation.token}`,
        },
        body: JSON.stringify({
          query: `mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
              success
              issue {
                id
                priority
                state {
                  id
                  name
                }
                assignee {
                  id
                  name
                }
              }
            }
          }`,
          variables: {
            id: input.issueId,
            input: {
              priority: input.priority,
              stateId: input.stateId,
              assigneeId: input.assigneeId,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "linear_api_request_failed",
        });
      }

      const payload = (await response.json()) as {
        data?: { issueUpdate?: { success: boolean; issue: unknown } };
        errors?: unknown;
      };

      if (payload.errors) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "linear_update_failed",
          cause: payload.errors,
        });
      }

      return payload.data?.issueUpdate;
    }),
});

export type LinearRouter = typeof linearRouter;
