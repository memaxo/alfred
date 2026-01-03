import crypto from "node:crypto";
import { URLSearchParams } from "node:url";
import { logger } from "@alfred/logger";
import { TRPCError } from "@trpc/server";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const LINEAR_AUTH_BASE = "https://linear.app/oauth/authorize";
export const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";
export const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";
export const DEFAULT_SCOPE = "read write";
export const STATE_TTL_SECONDS = 10 * 60; // 10 minutes

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SignedStatePayload = {
  user: string;
  nonce: string;
  ts: number;
};

export type LinearViewerPayload = {
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
};

export type TokenExchangeResult = {
  accessToken: string;
  refreshToken: string | null;
  scope: string;
  expiresIn: number | null;
};

export type IssueNode = {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  state?: { id: string; name: string; color: string };
  assignee?: { id: string; name: string; avatarUrl: string | null };
  project?: { id: string; name: string };
  team?: { id: string; name: string };
  labels?: { nodes: Array<{ id: string; name: string; color: string }> };
  createdAt: string;
  updatedAt: string;
};

export type IssueDetail = IssueNode & {
  comments?: {
    nodes: Array<{
      id: string;
      body: string;
      user?: { id: string; name: string };
      createdAt: string;
    }>;
  };
};

export type BoardIssue = {
  id: string;
  identifier: string;
  title: string;
  priority: number;
  state?: { id: string };
  assignee?: { id: string; name: string; avatarUrl: string | null };
};

export type WorkflowState = {
  id: string;
  name: string;
  color: string;
  type: string;
  position: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Environment Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getClientId(): string {
  const value = process.env.LINEAR_CLIENT_ID;
  if (!value) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "linear_client_id_missing",
    });
  }
  return value;
}

export function getClientSecret(): string {
  const value = process.env.LINEAR_CLIENT_SECRET;
  if (!value) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "linear_client_secret_missing",
    });
  }
  return value;
}

export function getRedirectUri(): string {
  const value = process.env.LINEAR_REDIRECT_URI;
  if (!value) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "linear_redirect_uri_missing",
    });
  }
  return value;
}

export function getScope(): string {
  return process.env.LINEAR_SCOPE?.trim() || DEFAULT_SCOPE;
}

function getStateSigningKey(): string {
  return process.env.LINEAR_STATE_SECRET?.trim() || getClientSecret();
}

// ─────────────────────────────────────────────────────────────────────────────
// State Signing
// ─────────────────────────────────────────────────────────────────────────────

export function signState(payload: SignedStatePayload): string {
  const raw = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getStateSigningKey())
    .update(raw)
    .digest("base64url");
  return `${raw}.${signature}`;
}

export function verifyState(state: string): SignedStatePayload {
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
    logger.warn("linear_state_parse_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "linear_state_invalid",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API Helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function exchangeAuthorizationCode(
  code: string,
  redirectUri: string
): Promise<TokenExchangeResult> {
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

export async function fetchLinearViewer(
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

export async function linearGraphQL<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "linear_api_request_failed",
    });
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: unknown;
  };

  if (payload.errors) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "linear_query_failed",
      cause: payload.errors,
    });
  }

  return payload.data as T;
}
