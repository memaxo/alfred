import type { Decision, PolicyResource } from "@alfred/policy";
import type { KeyLike } from "jose";

import { evaluate } from "@alfred/policy";
import {
  importPKCS8,
  importSPKI,
  type JWTPayload,
  jwtVerify,
  SignJWT,
} from "jose";
import { nanoid } from "nanoid";

import { getRedis } from "./redis";

const ISSUER = process.env.AGENT_ISSUER || "alfred";
const DEFAULT_AUDIENCE = process.env.TOOL_AUDIENCE || "alfred:tools";
const MCP_AUDIENCE = process.env.ALFRED_MCP_AUDIENCE || "alfred:mcp";
const KID = process.env.AGENT_JWK_KID || "agent-ed25519";
const DEFAULT_TTL =
  Number.parseInt(process.env.TOOL_TOKEN_TTL || "", 10) || 300;
const DEFAULT_MCP_TTL =
  Number.parseInt(process.env.ALFRED_MCP_TOKEN_TTL_SEC || "", 10) || 900;

let privateKeyPromise: Promise<KeyLike> | null = null;
let publicKeyPromise: Promise<KeyLike> | null = null;

function getPrivateKey() {
  if (!privateKeyPromise) {
    const rawKey = process.env.AGENT_ED25519_PRIVATE;
    if (!rawKey) {
      throw new Error("AGENT_ED25519_PRIVATE is not configured");
    }
    privateKeyPromise = importPKCS8(rawKey, "EdDSA");
  }
  return privateKeyPromise;
}

function getPublicKey() {
  if (!publicKeyPromise) {
    const rawKey = process.env.AGENT_ED25519_PUBLIC_PEM;
    if (!rawKey) {
      throw new Error("AGENT_ED25519_PUBLIC_PEM is not configured");
    }
    publicKeyPromise = importSPKI(rawKey, "EdDSA");
  }
  return publicKeyPromise;
}

export interface TokenClaims {
  sub: string;
  pid?: string; // ALFRED Project ID
  scopes: string[];
  roles?: string[];
  elevated?: boolean;
  mfa?: "passkey" | "totp" | "none";
  iat: number;
  exp: number;
  jti: string;
  aud: string | string[];
  iss: string;
}

interface IssueOptions {
  projectId?: string;
  ttlSec?: number;
  elevated?: boolean;
  mfa?: "passkey" | "none";
  roles?: string[];
}

export async function issueAccessToken(
  sub: string,
  scopes: string[],
  audience = DEFAULT_AUDIENCE,
  options: IssueOptions = {}
): Promise<string> {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new Error("Token scopes are required");
  }

  const now = Math.floor(Date.now() / 1000);
  const ttlSec =
    options.ttlSec && options.ttlSec > 0 ? options.ttlSec : DEFAULT_TTL;
  const exp = now + ttlSec;
  const jti = nanoid();

  const payload: JWTPayload & {
    pid?: string;
    scopes: string[];
    elevated?: boolean;
    mfa?: "passkey" | "totp" | "none";
    roles?: string[];
  } = {
    pid: options.projectId,
    scopes,
    elevated: options.elevated,
    mfa: options.mfa ?? "none",
    roles: options.roles,
  };

  const signer = new SignJWT(payload)
    .setProtectedHeader({ alg: "EdDSA", kid: KID })
    .setSubject(sub)
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(jti);

  return signer.sign(await getPrivateKey());
}

export function verifyAccessToken(
  token: string,
  audience = DEFAULT_AUDIENCE,
  requiredScopes: string[] = []
): Promise<TokenClaims> {
  return verifyAccessTokenInternal(token, audience, requiredScopes, {
    replayProtection: true,
  });
}

interface VerifyOptions {
  /** When false, skips JTI replay protection (required for multi-request sessions). */
  replayProtection: boolean;
}

async function verifyAccessTokenInternal(
  token: string,
  audience: string,
  requiredScopes: string[],
  options: VerifyOptions
): Promise<TokenClaims> {
  const { payload } = await jwtVerify(token, await getPublicKey(), {
    issuer: ISSUER,
    audience,
  });

  if (!payload.sub) {
    throw new Error("token_invalid_subject");
  }

  if (!(payload.exp && payload.iat)) {
    throw new Error("token_missing_exp");
  }

  if (!payload.jti) {
    throw new Error("token_missing_jti");
  }

  const scopes = Array.isArray(payload.scopes) ? payload.scopes : [];
  if (requiredScopes.length > 0) {
    const missing = requiredScopes.filter((scope) => !scopes.includes(scope));
    if (missing.length > 0) {
      throw new Error("token_missing_scope");
    }
  }

  const ttl = payload.exp - Math.floor(Date.now() / 1000);
  if (ttl <= 0) {
    throw new Error("token_expired");
  }

  if (options.replayProtection) {
    await cacheJTI(payload.jti, ttl);
  }

  return {
    sub: payload.sub,
    pid: typeof payload.pid === "string" ? payload.pid : undefined,
    scopes,
    roles: Array.isArray(payload.roles) ? payload.roles : undefined,
    elevated: payload.elevated === true,
    mfa:
      typeof payload.mfa === "string"
        ? (payload.mfa as "passkey" | "totp" | "none")
        : undefined,
    iat: payload.iat,
    exp: payload.exp,
    jti: payload.jti,
    aud: payload.aud ?? audience,
    iss: payload.iss ?? ISSUER,
  };
}

export function verifyMcpSessionToken(
  token: string,
  requiredScopes: string[] = [],
  audience = MCP_AUDIENCE
): Promise<TokenClaims> {
  return verifyAccessTokenInternal(token, audience, requiredScopes, {
    replayProtection: false,
  });
}

export function issueMcpSessionToken(
  sub: string,
  scopes: string[],
  options: IssueOptions = {},
  audience = MCP_AUDIENCE
): Promise<string> {
  const ttlSec =
    options.ttlSec && options.ttlSec > 0 ? options.ttlSec : DEFAULT_MCP_TTL;
  return issueAccessToken(sub, scopes, audience, { ...options, ttlSec });
}

export interface ToolPolicyInput {
  action: string;
  resource: PolicyResource;
  context?: Record<string, unknown>;
  audience?: string;
}

export interface ToolPolicyResult {
  decision: Decision;
  claims: TokenClaims;
}

export async function requireToolScopesAndPolicy(
  authz: string | undefined,
  requiredScopes: string[],
  policyInput: ToolPolicyInput
): Promise<ToolPolicyResult> {
  if (!authz?.startsWith("Bearer ")) {
    throw new Error("unauthorized");
  }

  const token = authz.slice("Bearer ".length);
  const audience = policyInput.audience ?? DEFAULT_AUDIENCE;
  // Tool tokens may be reused across multiple tool calls for the duration of a run.
  // Replay protection is intended for one-time tokens, not tool execution tokens.
  const claims = await verifyAccessTokenInternal(
    token,
    audience,
    requiredScopes,
    {
      replayProtection: false,
    }
  );

  const decision = await evaluate({
    subject: {
      id: claims.sub,
      roles: claims.roles ?? [],
      scopes: claims.scopes,
    },
    action: policyInput.action,
    resource: policyInput.resource,
    context: {
      ...(policyInput.context ?? {}),
      mfa: claims.mfa,
      elevated: claims.elevated,
      scopes: claims.scopes,
    },
  });

  if (!decision.allow) {
    throw new Error(decision.reason ?? "policy_denied");
  }

  return { decision, claims };
}

const memoryJti = new Map<string, number>();
const MAX_JTI_CACHE_SIZE = 10_000;

export async function cacheJTI(jti: string, ttlSec: number) {
  const redis = getRedis();
  if (redis) {
    const saved = await (
      redis.set as unknown as (
        key: string,
        value: string,
        options: { EX: number; NX: boolean }
      ) => Promise<string>
    )(`jti:${jti}`, "1", {
      EX: ttlSec,
      NX: true,
    });
    if (saved !== "OK") {
      throw new Error("token_replayed");
    }
    return;
  }

  const now = Date.now();
  const expiresAt = now + ttlSec * 1000;
  const existing = memoryJti.get(jti);
  if (existing && existing > now) {
    throw new Error("token_replayed");
  }

  // Evict oldest entry if cache is full (LRU-style eviction)
  if (memoryJti.size >= MAX_JTI_CACHE_SIZE) {
    const oldest = memoryJti.keys().next().value;
    if (oldest) {
      memoryJti.delete(oldest);
    }
  }

  memoryJti.set(jti, expiresAt);
  const timer = setTimeout(() => {
    memoryJti.delete(jti);
  }, ttlSec * 1000);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
}
