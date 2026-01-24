import {
  enrichReasoningContext,
  extractReasoning,
  type KnowledgeEntry,
  toKnowledge,
} from "@alfred/knowledge/extractor";
import { createHash } from "node:crypto";

type NodeSeed = {
  resource: string;
  hash: string;
  kind: string;
  label: string;
  projectId?: string;
  properties?: Record<string, unknown>;
};
type EdgeSeed = {
  resource: string;
  hash: string;
  fromId: string;
  toId: string;
  kind: string;
  projectId?: string;
  weight: number;
  metadata?: Record<string, unknown>;
};

function scopeResource(resource: string, projectId?: string): string {
  if (!projectId) {
    return resource;
  }
  return `project:${projectId}:${resource}`;
}

function nodeKey(resource: string, hash: string): string {
  return `${resource}:${hash}`;
}

function execplanRootHash(resource: string, runId: string): string {
  const hash = createHash("sha256");
  hash.update(resource);
  hash.update("|execplan_root|");
  hash.update(runId);
  return hash.digest("hex");
}

function execplanSubtaskHash(
  resource: string,
  runId: string,
  subTaskId: string
): string {
  const hash = createHash("sha256");
  hash.update(resource);
  hash.update("|execplan_subtask|");
  hash.update(runId);
  hash.update("|");
  hash.update(subTaskId);
  return hash.digest("hex");
}

function reasoningNodeHash(
  resource: string,
  executionId: string | undefined,
  index: number,
  timestamp: number,
  text: string
): string {
  const hash = createHash("sha256");
  hash.update(resource);
  hash.update("|");
  hash.update(executionId ?? "unknown");
  hash.update("|");
  hash.update(index.toString());
  hash.update("|");
  hash.update(timestamp.toString());
  hash.update("|");
  hash.update(text);
  return hash.digest("hex");
}

function makeNode(
  resource: string,
  entry: KnowledgeEntry,
  projectId?: string
): NodeSeed | null {
  const { data, hash } = entry;
  switch (data._) {
    case "fact":
      return {
        resource,
        hash,
        kind: data._,
        label: data.content,
        projectId,
        properties: {
          confidence: data.confidence,
          source: data.source,
          ts: data.ts,
        },
      };
    case "insight":
      return {
        resource,
        hash,
        kind: data._,
        label: data.conclusion,
        projectId,
        properties: {
          derived: data.derived,
          confidence: data.confidence,
        },
      };
    case "pattern":
      return {
        resource,
        hash,
        kind: data._,
        label: data.rule,
        projectId,
        properties: {
          examples: data.examples,
          accuracy: data.accuracy,
        },
      };
    default:
      return null;
  }
}

export async function linkRagProvenanceToReasoning(opts: {
  runtimeResource: string;
  executionId: string;
  projectId?: string;
}): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  try {
    const { getReasoningChain, findRagDocumentNode, upsertEdges } =
      await import("@alfred/db/repo/graph");

    const { nodes } = await getReasoningChain({
      resource: scopeResource(opts.runtimeResource, opts.projectId),
      executionId: opts.executionId,
      limit: 500,
    });

    if (!nodes.length) {
      return;
    }

    const docToReasoning = new Map<string, string[]>();
    for (const node of nodes) {
      const props = (node.properties ?? null) as Record<string, unknown> | null;
      const ids = Array.isArray(props?.ragDocumentIds)
        ? (props?.ragDocumentIds as unknown[])
        : [];
      for (const rawId of ids) {
        if (typeof rawId !== "string" || rawId.length === 0) {
          continue;
        }
        const list = docToReasoning.get(rawId) ?? [];
        list.push(node.id);
        docToReasoning.set(rawId, list);
      }
    }

    if (docToReasoning.size === 0) {
      return;
    }

    const edgeSeeds: EdgeSeed[] = [];
    const projectResource = scopeResource("user", opts.projectId);
    for (const [documentId, reasoningIds] of docToReasoning.entries()) {
      const docNode = await findRagDocumentNode(documentId, opts.projectId);
      if (!docNode) {
        continue;
      }

      for (const reasoningId of reasoningIds) {
        const edgeHash = createHash("sha256")
          .update(projectResource)
          .update("|rag_explains|")
          .update(docNode.id)
          .update("|")
          .update(reasoningId)
          .digest("hex");

        edgeSeeds.push({
          resource: projectResource,
          hash: edgeHash,
          fromId: docNode.id,
          toId: reasoningId,
          kind: "explains",
          projectId: opts.projectId,
          weight: 1,
          metadata: {
            documentId,
            reason: "rag_provenance",
            runtimeResource: opts.runtimeResource,
            executionId: opts.executionId,
          },
        });
      }
    }

    if (edgeSeeds.length === 0) {
      return;
    }

    await upsertEdges(edgeSeeds);
  } catch (_error) {}
}

function makeEdge(
  resource: string,
  entry: KnowledgeEntry,
  nodes: Map<string, { id: string }>,
  projectId?: string
): EdgeSeed | null {
  if (entry.data._ !== "relation") {
    return null;
  }

  const fromHash = String(entry.data.from);
  const toHash = String(entry.data.to);
  const from = nodes.get(nodeKey(resource, fromHash));
  const to = nodes.get(nodeKey(resource, toHash));
  if (!(from && to)) {
    return null;
  }

  return {
    resource,
    hash: entry.hash,
    fromId: from.id,
    toId: to.id,
    kind: entry.data.kind,
    projectId,
    weight: entry.data.weight,
    metadata: {
      from: fromHash,
      to: toHash,
    },
  };
}

export async function persistKnowledge(
  resource: string,
  entries: KnowledgeEntry[],
  projectId?: string
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    return;
  }

  const scoped = scopeResource(resource, projectId);

  const nodeSeeds: NodeSeed[] = [];
  const edgeSeeds: KnowledgeEntry[] = [];

  for (const entry of entries) {
    const nodeSeed = makeNode(scoped, entry, projectId);
    if (nodeSeed) {
      nodeSeeds.push(nodeSeed);
    }
    if (entry.data._ === "relation") {
      edgeSeeds.push(entry);
    }
  }

  try {
    const { upsertNodes, upsertEdges } = await import("@alfred/db/repo/graph");
    const nodeMap = await upsertNodes(nodeSeeds);
    if (edgeSeeds.length === 0) {
      return;
    }

    const idMap = new Map<string, { id: string }>();
    for (const row of nodeMap.values()) {
      idMap.set(nodeKey(row.resource, row.hash), { id: row.id });
    }

    const edges: EdgeSeed[] = [];
    for (const relation of edgeSeeds) {
      const seed = makeEdge(scoped, relation, idMap, projectId);
      if (seed) {
        edges.push(seed);
      }
    }

    if (edges.length === 0) {
      return;
    }

    await upsertEdges(edges);
  } catch (_err) {}
}

export async function persistExecPlans(opts: {
  resource: string;
  runId: string;
  rootPath: string;
  subtasks: { id: string; path: string }[];
}): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const { resource, runId, rootPath, subtasks } = opts;

  const nodeSeeds: NodeSeed[] = [];

  const rootHash = execplanRootHash(resource, runId);

  nodeSeeds.push({
    resource,
    hash: rootHash,
    kind: "execplan_root",
    label: `ExecPlan root for run ${runId}`,
    properties: {
      runId,
      path: rootPath,
    },
  });

  for (const sub of subtasks) {
    const subHash = execplanSubtaskHash(resource, runId, sub.id);
    nodeSeeds.push({
      resource,
      hash: subHash,
      kind: "execplan_subtask",
      label: `Subtask ${sub.id}`,
      properties: {
        runId,
        subTaskId: sub.id,
        path: sub.path,
      },
    });
  }

  try {
    const { upsertNodes, upsertEdges } = await import("@alfred/db/repo/graph");
    const nodeMap = await upsertNodes(nodeSeeds);

    const hashToRow = new Map<string, { id: string; hash: string }>();
    for (const row of nodeMap.values()) {
      hashToRow.set(row.hash, { id: row.id, hash: row.hash });
    }

    const rootRow = hashToRow.get(rootHash);
    if (!rootRow) {
      return;
    }

    const edgeSeeds: EdgeSeed[] = [];
    for (const sub of subtasks) {
      const subHash = execplanSubtaskHash(resource, runId, sub.id);
      const subRow = hashToRow.get(subHash);
      if (!subRow) {
        continue;
      }

      const edgeHash = createHash("sha256")
        .update(resource)
        .update("|execplan_subtask_of|")
        .update(subRow.hash)
        .update("|")
        .update(rootRow.hash)
        .digest("hex");

      edgeSeeds.push({
        resource,
        hash: edgeHash,
        fromId: subRow.id,
        toId: rootRow.id,
        kind: "subtask_of",
        weight: 1,
        metadata: {
          runId,
          subTaskId: sub.id,
        },
      });
    }

    if (edgeSeeds.length > 0) {
      await upsertEdges(edgeSeeds);
    }
  } catch (_error) {}
}

/**
 * Persist reasoning traces to knowledge graph
 * Creates temporal chain of reasoning nodes with metadata
 */
export async function persistReasoning(
  resource: string,
  traces: Array<{ text: string; timestamp: number }>,
  context?: {
    threadId?: string;
    executionId?: string;
    auto?: string;
    ragDocumentIds?: string[];
    projectId?: string;
  }
): Promise<void> {
  if (traces.length === 0) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    return;
  }

  const allEntries: KnowledgeEntry[] = [];
  const executionKey = context?.executionId ?? context?.threadId ?? resource;
  const projectId = context?.projectId;
  const scoped = scopeResource(resource, projectId);

  for (const trace of traces) {
    const extraction = await extractReasoning(trace.text, {
      threadId: context?.threadId,
      source: `reasoning:${executionKey}`,
    });

    const entries = toKnowledge(extraction);
    const enriched = enrichReasoningContext(entries, {
      threadId: context?.threadId,
      sessionId: executionKey,
      timestamp: trace.timestamp,
    });

    allEntries.push(...enriched);
  }

  if (allEntries.length === 0) {
    return;
  }

  try {
    await persistKnowledge(resource, allEntries, projectId);

    if (traces.length === 0) {
      return;
    }

    const nodeSeeds: NodeSeed[] = traces.map((trace, index) => {
      const hash = reasoningNodeHash(
        scoped,
        context?.executionId,
        index,
        trace.timestamp,
        trace.text
      );

      return {
        resource: scoped,
        hash,
        kind: "reasoning",
        label: trace.text.substring(0, 100),
        projectId,
        properties: {
          timestamp: trace.timestamp,
          index,
          sequenceIndex: index,
          threadId: context?.threadId,
          executionId: executionKey,
          auto: context?.auto,
          ragDocumentIds: context?.ragDocumentIds,
        },
      };
    });

    for (let i = 0; i < nodeSeeds.length; i++) {
      const current = nodeSeeds[i];
      if (!current) {
        continue;
      }
      const properties = (current.properties ??= {});
      const previous = nodeSeeds[i - 1];
      const next = nodeSeeds[i + 1];
      if (previous) {
        (properties as Record<string, unknown>).previousHash = previous.hash;
      }
      if (next) {
        (properties as Record<string, unknown>).nextHash = next.hash;
      }
    }

    const { upsertNodes, upsertEdges } = await import("@alfred/db/repo/graph");
    const nodeMap = await upsertNodes(nodeSeeds);
    const hashToRow = new Map<string, { id: string; hash: string }>();
    for (const row of nodeMap.values()) {
      hashToRow.set(row.hash, { id: row.id, hash: row.hash });
    }

    if (nodeSeeds.length > 1) {
      const edgeSeeds: EdgeSeed[] = [];
      for (let i = 0; i < nodeSeeds.length - 1; i++) {
        const currentSeed = nodeSeeds[i];
        const nextSeed = nodeSeeds[i + 1];
        if (!(currentSeed && nextSeed)) {
          continue;
        }
        const currentRow = hashToRow.get(currentSeed.hash);
        const nextRow = hashToRow.get(nextSeed.hash);
        if (!(currentRow && nextRow)) {
          continue;
        }

        const delta =
          (traces[i + 1]?.timestamp ?? traces[i]?.timestamp ?? 0) -
          (traces[i]?.timestamp ?? 0);
        const edgeHash = createHash("sha256")
          .update(scoped)
          .update("|")
          .update(currentSeed.hash)
          .update("|")
          .update(nextSeed.hash)
          .digest("hex");

        edgeSeeds.push({
          resource: scoped,
          hash: edgeHash,
          fromId: currentRow.id,
          toId: nextRow.id,
          kind: "precedes",
          projectId,
          weight: 1,
          metadata: {
            timeDelta: delta,
            fromIndex: currentSeed.properties?.sequenceIndex ?? i,
            toIndex: nextSeed.properties?.sequenceIndex ?? i + 1,
          },
        });
      }

      if (edgeSeeds.length > 0) {
        await upsertEdges(edgeSeeds);
      }
    }
  } catch (_err) {}
}

type CodexArtifact = {
  path: string;
  kind: string;
};

function codexExecutionHash(
  resource: string,
  sessionId: string | undefined,
  threadId: string | undefined,
  createdAt: number
): string {
  const hash = createHash("sha256");
  hash.update(resource);
  hash.update("|codex_exec|");
  hash.update(sessionId ?? "session");
  hash.update("|");
  hash.update(threadId ?? "thread");
  hash.update("|");
  hash.update(String(createdAt));
  return hash.digest("hex");
}

function codexArtifactHash(
  resource: string,
  pathValue: string,
  createdAt: number
): string {
  const hash = createHash("sha256");
  hash.update(resource);
  hash.update("|codex_artifact|");
  hash.update(pathValue);
  hash.update("|");
  hash.update(String(createdAt));
  return hash.digest("hex");
}

export async function persistCodexExecution(
  resource: string,
  options: {
    sessionId?: string;
    threadId?: string;
    auto?: string;
    projectId?: string;
    result: string;
    artifacts?: CodexArtifact[];
  }
): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const scopedResource = scopeResource(resource, options.projectId);

  const trimmed = options.result.trim();
  if (!trimmed) {
    return;
  }

  const createdAt = Date.now();
  const execHash = codexExecutionHash(
    scopedResource,
    options.sessionId,
    options.threadId,
    createdAt
  );

  const nodeSeeds: NodeSeed[] = [];

  nodeSeeds.push({
    resource: scopedResource,
    hash: execHash,
    kind: "codex_execution",
    label: trimmed.slice(0, 120),
    projectId: options.projectId,
    properties: {
      sessionId: options.sessionId,
      threadId: options.threadId,
      auto: options.auto,
      createdAt,
    },
  });

  const artifactSeeds: NodeSeed[] = [];

  for (const artifact of options.artifacts ?? []) {
    if (!artifact.path) {
      continue;
    }
    const artifactHash = codexArtifactHash(
      scopedResource,
      artifact.path,
      createdAt
    );
    artifactSeeds.push({
      resource: scopedResource,
      hash: artifactHash,
      kind: "codex_artifact",
      label: artifact.path,
      projectId: options.projectId,
      properties: {
        path: artifact.path,
        kind: artifact.kind,
        sessionId: options.sessionId,
        threadId: options.threadId,
        createdAt,
      },
    });
  }

  if (artifactSeeds.length > 0) {
    nodeSeeds.push(...artifactSeeds);
  }

  try {
    const { upsertNodes, upsertEdges } = await import("@alfred/db/repo/graph");
    const nodeMap = await upsertNodes(nodeSeeds);
    const hashToRow = new Map<string, { id: string; hash: string }>();
    for (const row of nodeMap.values()) {
      hashToRow.set(row.hash, { id: row.id, hash: row.hash });
    }

    if (artifactSeeds.length === 0) {
      return;
    }

    const execRow = hashToRow.get(execHash);
    if (!execRow) {
      return;
    }

    const edgeSeeds: EdgeSeed[] = [];
    for (const seed of artifactSeeds) {
      const artifactRow = hashToRow.get(seed.hash);
      if (!artifactRow) {
        continue;
      }
      const edgeHash = createHash("sha256")
        .update(scopedResource)
        .update("|codex_has_artifact|")
        .update(execRow.hash)
        .update("|")
        .update(artifactRow.hash)
        .digest("hex");
      edgeSeeds.push({
        resource: scopedResource,
        hash: edgeHash,
        fromId: execRow.id,
        toId: artifactRow.id,
        kind: "has_artifact",
        weight: 1,
        projectId: options.projectId,
        metadata: {
          type: "codex_execution_artifact",
        },
      });
    }

    if (edgeSeeds.length > 0) {
      await upsertEdges(edgeSeeds);
    }
  } catch (_err) {}
}
