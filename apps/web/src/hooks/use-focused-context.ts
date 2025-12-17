import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import type { ArtifactData } from "@/store/mindscape";
import { useMindscapeStore } from "@/store/mindscape";
import { trpc } from "@/utils/trpc";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const coerceString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const coerceDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value);
  }
  return null;
};

type ContextState = {
  content: string | null;
  nodeType: string | null;
  label: string | null;
  isLoading: boolean;
  isError: boolean;
  ragDocuments: Array<{
    label: string;
    summary: string;
    source: "vector" | "graph";
  }>;
};

type ContextSnapshot = {
  status: "cache" | "live";
  summary?: string;
  timestamp: Date;
  phase?: "cache" | "scan" | "web" | "bundle";
  source?: "handoff" | "cache" | "scan";
};

type FocusedContext = ContextState & {
  contextSnapshot: ContextSnapshot | null;
};

export function useFocusedContext(): FocusedContext {
  const focusedNodeId = useMindscapeStore((state) => state.focusedNodeId);
  const nodes = useMindscapeStore((state) => state.nodes);
  const edges = useMindscapeStore((state) => state.edges);
  const contextCache = useMindscapeStore((state) => state.contextCache);

  const [localContext, setLocalContext] = useState<ContextState>({
    content: null,
    nodeType: null,
    label: null,
    isLoading: false,
    isError: false,
    ragDocuments: [],
  });

  // Logic: If focused node is Chat, try to find a connected "Topic" node.
  // Otherwise, use the focused node itself.
  const effectiveNodeId = useMemo(() => {
    if (!focusedNodeId) return null;
    const node = nodes.find((n) => n.id === focusedNodeId);
    if (!node) return null;

    if (node.type === "chat") {
      // Look for connected edges
      const connectedEdge = edges.find(
        (e) => e.source === focusedNodeId || e.target === focusedNodeId
      );

      if (connectedEdge) {
        // Prioritize the *other* node
        const otherId =
          connectedEdge.source === focusedNodeId
            ? connectedEdge.target
            : connectedEdge.source;
        // Avoid jumping to another chat or orb if possible, but for now just take the first neighbor
        return otherId;
      }
    }
    return focusedNodeId;
  }, [focusedNodeId, nodes, edges]);

  const focusedNode = nodes.find((n) => n.id === effectiveNodeId);
  const focusedGraphNodeId = useMemo(() => {
    const data = focusedNode?.data as ArtifactData | undefined;
    const dbId = data?.graph?.dbId;
    return typeof dbId === "string" && dbId.length > 0 ? dbId : null;
  }, [focusedNode]);

  // 1. Extract local data from the node immediately
  useEffect(() => {
    if (!focusedNode) {
      setLocalContext({
        content: null,
        nodeType: null,
        label: null,
        isLoading: false,
        isError: false,
        ragDocuments: [],
      });
      return;
    }

    const data = focusedNode.data as ArtifactData;
    let content = "";

    // Type-safe access using discriminated union checks or 'in' operator
    if ("content" in data && typeof data.content === "string") {
      content += data.content;
    }

    if ("summary" in data && typeof data.summary === "string") {
      content += `\nSummary: ${data.summary}`;
    }

    if ("description" in data && typeof data.description === "string") {
      content += `\nDescription: ${data.description}`;
    }

    if ("messages" in data && Array.isArray(data.messages)) {
      // Extract text from last 3 messages using AI SDK v6 parts structure
      const recent = data.messages
        .slice(-3)
        .map((m) => {
          // Handle AI SDK v6 parts array
          if (Array.isArray(m.parts)) {
            return m.parts
              .filter(
                (p): p is { type: "text"; text: string } => p.type === "text"
              )
              .map((p) => p.text ?? "")
              .join(" ");
          }
          return "";
        })
        .join("\n");
      content += `\nRecent Messages:\n${recent}`;
    }

    const title =
      "title" in data && typeof data.title === "string" ? data.title : null;
    const label =
      coerceString(data.label) ??
      coerceString(title) ??
      (content.trim().length > 0 ? "Focused context" : "Untitled");

    setLocalContext({
      content: content.trim() || null,
      nodeType: focusedNode.type || "unknown",
      label,
      isLoading: false,
      isError: false,
      ragDocuments: [],
    });
  }, [focusedNode]);

  // 2. "Active RAG" - Fetch related context for complex nodes
  const focusedArtifact = focusedNode?.data as ArtifactData | undefined;
  const focusedLabel = coerceString(focusedArtifact?.label);
  const focusedSummary =
    focusedArtifact && "summary" in focusedArtifact
      ? coerceString(focusedArtifact.summary)
      : null;
  const focusedDescription =
    focusedArtifact && "description" in focusedArtifact
      ? coerceString(focusedArtifact.description)
      : null;

  const shouldFetchRag = Boolean(
    focusedNode &&
      (focusedNode.type === "knowledge" || focusedNode.type === "concept") &&
      focusedLabel
  );

  const queryText = shouldFetchRag
    ? `${focusedLabel ?? ""} ${focusedSummary ?? focusedDescription ?? ""}`.trim()
    : "";

  // Debounce the query text to prevent spamming the backend during rapid navigation
  const debouncedQueryText = useDebounce(queryText, 300);

  // Fetch model configuration to determine context budget
  const configQuery = trpc.assistant.getConfig.useQuery(undefined, {
    staleTime: Number.POSITIVE_INFINITY, // Config rarely changes
  });

  // Calculate dynamic budget based on model context window (30% heuristic)
  const contextBudget = useMemo(() => {
    const windowTokens = Number(
      (configQuery.data as { contextWindow?: unknown } | undefined)?.contextWindow
    );
    if (!Number.isFinite(windowTokens) || windowTokens <= 0) {
      return 2000;
    }
    // 30% of context window, converted to approx characters (1 token ~= 4 chars)
    // Example: 128k tokens * 0.3 * 4 = 153,600 chars
    return Math.floor(windowTokens * 0.3 * 4);
  }, [configQuery.data]);

  // Dynamic topK: Aim to fill the budget. Assuming ~2000 chars per chunk (500 tokens).
  const targetTopK = Math.max(3, Math.ceil(contextBudget / 2000));

  const ragQuery = trpc.graph.runQuery.useQuery(
    {
      kind: "context",
      nodeId: focusedGraphNodeId ?? "",
      text: debouncedQueryText,
      topK: Math.min(targetTopK, 50),
    },
    {
      enabled:
        !!shouldFetchRag &&
        debouncedQueryText.length > 0 &&
        !!configQuery.data &&
        !!focusedGraphNodeId,
      staleTime: 1000 * 60 * 5, // Cache for 5 minutes
      retry: false,
    }
  );

  // Highlight graph edges involved in the context
  const setHighlightedEdges = useMindscapeStore(
    (state) => state.setHighlightedEdges
  );
  useEffect(() => {
    const edgesValue = (ragQuery.data as { edges?: unknown } | undefined)?.edges;
    if (!Array.isArray(edgesValue) || edgesValue.length === 0) {
      setHighlightedEdges([]);
      return;
    }
    const ids: string[] = [];
    for (const edge of edgesValue) {
      if (!isRecord(edge)) {
        continue;
      }
      const id = coerceString(edge.id);
      if (id) {
        ids.push(id);
      }
    }
    setHighlightedEdges(ids);
  }, [ragQuery.data, setHighlightedEdges]);

  // 3. Merge local context with Active RAG results
  return useMemo(() => {
    const contextEntry =
      effectiveNodeId && contextCache
        ? contextCache[effectiveNodeId]
        : undefined;
    const contextSnapshot: ContextSnapshot | null = contextEntry
      ? {
          status:
            contextEntry.source === "handoff" || contextEntry.phase === "cache"
              ? ("cache" as const)
              : ("live" as const),
          summary: contextEntry.receipt?.summary,
          timestamp:
            coerceDate(contextEntry.receipt?.created) ??
            new Date(contextEntry.updatedAt ?? Date.now()),
          phase: contextEntry.phase,
          source: contextEntry.source,
        }
      : null;

    if (!localContext.label) return { ...localContext, contextSnapshot };

    let combinedContent = localContext.content || "";
    const ragDocuments: Array<{
      label: string;
      summary: string;
      source: "vector" | "graph";
    }> = [];
    const MAX_RAG_CONTEXT_CHARS = contextBudget;

    if (
      ragQuery.data &&
      ragQuery.data.nodes &&
      ragQuery.data.nodes.length > 0
    ) {
      const nodesValue = (ragQuery.data as { nodes?: unknown } | undefined)
        ?.nodes;
      const nodesList = Array.isArray(nodesValue) ? nodesValue : [];
      const potentialDocs = nodesList
        .filter((raw) => {
          if (!focusedGraphNodeId) {
            return true;
          }
          if (!isRecord(raw)) {
            return true;
          }
          const idValue = raw.id;
          if (isRecord(idValue)) {
            const id =
              coerceString(idValue.dbId) ??
              coerceString(idValue.uiId) ??
              coerceString(idValue.hgHash);
            return id ? id !== focusedGraphNodeId : true;
          }
          if (typeof idValue === "string") {
            return idValue !== focusedGraphNodeId;
          }
          return true;
        })
        .map((raw) => {
          const node = isRecord(raw) ? raw : {};
          const kind = coerceString(node.kind);
          const isGraph = kind === "link";

          const props = isRecord(node.properties) ? node.properties : {};
          const data = isRecord(node.data) ? node.data : {};

          let summary = "";
          if (isGraph) {
            const rel = coerceString(props.relation) ?? "related to";
            const dir = coerceString(props.direction) ?? "outgoing";
            const label = localContext.label ?? "this node";
            summary = `(Graph Edge) ${dir === "incoming" ? `Is ${rel} by` : rel} ${label}`;
          } else {
            const fromData =
              coerceString(data.summary) ??
              (typeof data.content === "string"
                ? data.content.slice(0, 200)
                : null);
            summary = fromData ?? "";
          }

          const label =
            coerceString(node.label) ?? coerceString(data.label) ?? "Unknown";
          return {
            label,
            summary,
            source: isGraph ? ("graph" as const) : ("vector" as const),
          };
        });

      if (potentialDocs.length > 0) {
        let currentLength = combinedContent.length;
        const intro = "\n\n[Active RAG Context]\n";
        currentLength += intro.length;

        if (currentLength < MAX_RAG_CONTEXT_CHARS) {
          combinedContent += intro;

          for (const doc of potentialDocs) {
            const prefix = doc.source === "graph" ? "[Graph]" : "[Vector]";
            const entry = `- ${prefix} ${doc.label}: ${doc.summary}`;

            if (currentLength + entry.length > MAX_RAG_CONTEXT_CHARS) {
              // Prioritize Graph edges (they are usually short). If vector doc, truncate.
              if (doc.source === "vector") {
                const remaining = MAX_RAG_CONTEXT_CHARS - currentLength - 5;
                if (remaining > 20) {
                  const truncated = entry.slice(0, remaining) + "...";
                  combinedContent += truncated + "\n";
                  ragDocuments.push({
                    ...doc,
                    summary:
                      doc.summary.slice(
                        0,
                        remaining - doc.label.length - prefix.length - 5
                      ) + "...",
                  });
                }
                break;
              }
              // Graph edge: try to squeeze it in or skip if literally no space
              if (currentLength + entry.length < MAX_RAG_CONTEXT_CHARS + 500) {
                // Allow small overflow for graph
                combinedContent += entry + "\n";
                currentLength += entry.length + 1;
                ragDocuments.push(doc);
              }
            } else {
              combinedContent += entry + "\n";
              currentLength += entry.length + 1;
              ragDocuments.push(doc);
            }
          }
        }
      }
    }

    return {
      ...localContext,
      content: combinedContent.trim() || null,
      isLoading: localContext.isLoading || ragQuery.isLoading,
      isError: ragQuery.isError,
      ragDocuments,
      contextSnapshot,
    };
  }, [
    localContext,
    ragQuery.data,
    ragQuery.isLoading,
    ragQuery.isError,
    focusedGraphNodeId,
    contextBudget,
    contextCache,
    effectiveNodeId,
  ]);
}
