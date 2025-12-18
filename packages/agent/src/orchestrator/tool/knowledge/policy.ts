/**
 * Knowledge Graph Tool Policy Enforcement
 * Policy checks for knowledge graph operations
 */

import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import type {
  KnowledgeConnectInput,
  KnowledgeCorrectInput,
  KnowledgeExtractInput,
  KnowledgeQueryInput,
} from "./definition.js";

/**
 * Enforce policy for knowledge_query (read-only)
 * Scope: knowledge.read
 * Autonomy: read (0.0-0.3)
 */
export async function enforceQueryPolicy(
  input: KnowledgeQueryInput
): Promise<void> {
  await requireToolScopesAndPolicy(input.authz, ["knowledge.read"], {
    action: "knowledge.query",
    resource: {
      kind: "knowledge",
      id: input.resource ?? "user",
    },
  });
}

/**
 * Enforce policy for knowledge_extract (write)
 * Scope: knowledge.write
 * Autonomy: low (0.3-0.5) - safe mutations
 */
export async function enforceExtractPolicy(
  input: KnowledgeExtractInput
): Promise<void> {
  // Validate content size (max 100KB for extraction)
  const maxContentSize = 100 * 1024;
  if (input.content.length > maxContentSize) {
    throw new Error("knowledge_content_too_large");
  }

  await requireToolScopesAndPolicy(input.authz, ["knowledge.write"], {
    action: "knowledge.extract",
    resource: {
      kind: "knowledge",
      id: input.resource,
    },
  });
}

/**
 * Enforce policy for knowledge_connect (write)
 * Scope: knowledge.write
 * Autonomy: low (0.3-0.5) - safe mutations
 */
export async function enforceConnectPolicy(
  input: KnowledgeConnectInput
): Promise<void> {
  await requireToolScopesAndPolicy(input.authz, ["knowledge.write"], {
    action: "knowledge.connect",
    resource: {
      kind: "knowledge",
      id: input.resource,
    },
  });
}

function countTargets(input: KnowledgeCorrectInput): number {
  let count = 0;
  if (typeof input.nodeId === "string") {
    count += 1;
  }
  if (typeof input.factId === "string") {
    count += 1;
  }
  if (typeof input.edgeId === "string") {
    count += 1;
  }
  return count;
}

/**
 * Enforce policy for knowledge_correct (dangerous operation)
 * Scope: knowledge.write
 * Autonomy: high (0.7-0.9) - dangerous operation
 * Requires elevated authz + biometric elevation
 */
export async function enforceCorrectPolicy(
  input: KnowledgeCorrectInput
): Promise<{ userId: string }> {
  if (countTargets(input) !== 1) {
    throw new Error("knowledge_correct_target_required");
  }

  if (input.correction.reason.trim().length === 0) {
    throw new Error("knowledge_correct_reason_required");
  }

  if (input.correction.type === "delete" && !input.confirm) {
    throw new Error("knowledge_correct_confirmation_required");
  }

  const { claims } = await requireToolScopesAndPolicy(
    input.authz,
    ["knowledge.write"],
    {
      action: "knowledge.correct",
      resource: {
        kind: "knowledge",
        id: input.resource ?? "user",
      },
      context: {
        requireElevated: true,
        requireBiometric: true,
      },
    }
  );

  if (!(claims.elevated && claims.mfa === "passkey")) {
    throw new Error("biometric_required");
  }

  return { userId: claims.sub };
}
