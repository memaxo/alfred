/**
 * Knowledge Graph Tool Policy Enforcement
 * Policy checks for knowledge graph operations
 */

import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import type {
  KnowledgeConnectInput,
  KnowledgeExtractInput,
  KnowledgeQueryInput,
} from "./definition.js";

/**
 * Enforce policy for knowledge_query (read-only)
 * Scope: knowledge.read
 * Autonomy: read (0.0-0.3)
 */
export async function enforceQueryPolicy(input: KnowledgeQueryInput): Promise<void> {
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
export async function enforceExtractPolicy(input: KnowledgeExtractInput): Promise<void> {
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
export async function enforceConnectPolicy(input: KnowledgeConnectInput): Promise<void> {
  await requireToolScopesAndPolicy(input.authz, ["knowledge.write"], {
    action: "knowledge.connect",
    resource: {
      kind: "knowledge",
      id: input.resource,
    },
  });
}
