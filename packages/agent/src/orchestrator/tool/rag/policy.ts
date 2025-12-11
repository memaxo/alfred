/**
 * RAG Tool Policy Enforcement
 * Handles authorization and policy checks for RAG operations
 */

import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import type {
  RagDeleteInput,
  RagIngestInput,
  RagListInput,
  RagQueryInput,
} from "./definition.js";

// Maximum document size (10MB)
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;

/**
 * Enforce policy for rag_ingest (write operation)
 * Scope: rag.write
 * Autonomy: medium (0.5-0.7) - potentially impactful
 */
export async function enforceIngestPolicy(input: RagIngestInput) {
  // Validate content size
  if (input.content.length > MAX_DOCUMENT_SIZE) {
    throw new Error("rag_content_too_large");
  }

  await requireToolScopesAndPolicy(input.authz, ["rag.write"], {
    action: "rag.ingest",
    resource: {
      kind: "rag",
      id: input.source,
    },
    context: {
      contentLength: input.content.length,
      enrichGraph: input.enrichGraph ?? false,
    },
  });
}

/**
 * Enforce policy for rag_query (read operation)
 * Scope: rag.read
 * Autonomy: read (0.0-0.3) - read-only operation
 */
export async function enforceQueryPolicy(input: RagQueryInput) {
  await requireToolScopesAndPolicy(input.authz, ["rag.read"], {
    action: "rag.query",
    resource: {
      kind: "rag",
      id: input.source ?? "all",
    },
  });
}

/**
 * Enforce policy for rag_list (read operation)
 * Scope: rag.read
 * Autonomy: read (0.0-0.3) - read-only operation
 */
export async function enforceListPolicy(input: RagListInput) {
  await requireToolScopesAndPolicy(input.authz, ["rag.read"], {
    action: "rag.list",
    resource: {
      kind: "rag",
      id: input.source ?? "all",
    },
  });
}

/**
 * Enforce policy for rag_delete (dangerous operation)
 * Scope: rag.write
 * Autonomy: high (0.7-0.9) - dangerous operation
 * Requires elevated authz + biometric elevation
 */
export async function enforceDeletePolicy(input: RagDeleteInput) {
  // Require explicit confirmation
  if (!input.confirm) {
    throw new Error("rag_delete_confirmation_required");
  }

  await requireToolScopesAndPolicy(input.authz, ["rag.write"], {
    action: "rag.delete",
    resource: {
      kind: "rag",
      id: input.documentId,
    },
    context: {
      requireElevated: true,
      requireBiometric: true,
    },
  });
}
