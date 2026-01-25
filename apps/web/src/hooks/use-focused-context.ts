import { useEffect, useMemo, useState } from "react";

import { useDebounce } from "@/hooks/use-debounce";
import { useDesktopStore, type WindowData } from "@/store/desktop";
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

interface ContextState {
  content: string | null;
  nodeType: string | null;
  label: string | null;
  isLoading: boolean;
  isError: boolean;
  ragDocuments: {
    label: string;
    summary: string;
    source: "vector" | "graph";
  }[];
}

interface ContextSnapshot {
  status: "cache" | "live";
  summary?: string;
  timestamp: Date;
  phase?: "cache" | "scan" | "web" | "bundle";
  source?: "handoff" | "cache" | "scan";
}

type FocusedContext = ContextState & {
  contextSnapshot: ContextSnapshot | null;
};

export function useFocusedContext(): FocusedContext {
  const focusedWindowId = useDesktopStore((state) => state.focusedWindowId);
  const windows = useDesktopStore((state) => state.windows);
  const contextCache = useDesktopStore((state) => state.contextCache);

  const [localContext, setLocalContext] = useState<ContextState>({
    content: null,
    nodeType: null,
    label: null,
    isLoading: false,
    isError: false,
    ragDocuments: [],
  });

  // Logic: If focused window is Chat, try to find a connected "Topic" window.
  // Otherwise, use the focused window itself.
  const effectiveWindowId = useMemo(() => {
    if (!focusedWindowId) {
      return null;
    }
    const window = windows.find((w) => w.id === focusedWindowId);
    if (!window) {
      return null;
    }

    // NOTE: Edge-based context connection removed in new type system
    // Previously, chat windows could connect to topic windows via edges
    return focusedWindowId;
  }, [focusedWindowId, windows]);

  const focusedWindow = windows.find((w) => w.id === effectiveWindowId);
  const focusedGraphNodeId = useMemo(() => {
    const data = focusedWindow?.data as
      | (WindowData & { graph?: { dbId?: string } })
      | undefined;
    const dbId = data?.graph?.dbId;
    return typeof dbId === "string" && dbId.length > 0 ? dbId : null;
  }, [focusedWindow]);

  // 1. Extract local data from the window immediately
  useEffect(() => {
    if (!focusedWindow) {
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

    const data = focusedWindow.data as WindowData & Record<string, unknown>;
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
      const recent = (
        data.messages as {
          parts?: { type: string; text?: string }[];
        }[]
      )
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
      nodeType: data.type || "unknown",
      label,
      isLoading: false,
      isError: false,
      ragDocuments: [],
    });
  }, [focusedWindow]);

  // 2. "Active RAG" - Fetch related context for complex windows
  const focusedData = focusedWindow?.data as
    | (WindowData & Record<string, unknown>)
    | undefined;
  const focusedLabel = coerceString(focusedData?.label);
  const focusedSummary =
    focusedData && "summary" in focusedData
      ? coerceString(focusedData.summary)
      : null;
  const focusedDescription =
    focusedData && "description" in focusedData
      ? coerceString(focusedData.description)
      : null;

  const shouldFetchRag = Boolean(
    focusedWindow &&
    (focusedData?.type === "knowledge" || focusedData?.type === "concept") &&
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
      (configQuery.data as { contextWindow?: unknown } | undefined)
        ?.contextWindow
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

  // NOTE: setHighlightedEdges removed in new type system
  const setHighlightedEdges = (_ids: string[]) => {};
  useEffect(() => {
    const edgesValue = (ragQuery.data as { edges?: unknown } | undefined)
      ?.edges;
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
      effectiveWindowId && contextCache
        ? contextCache[effectiveWindowId]
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

    if (!localContext.label) {
      return { ...localContext, contextSnapshot };
    }

    let combinedContent = localContext.content || "";
    const ragDocuments: {
      label: string;
      summary: string;
      source: "vector" | "graph";
    }[] = [];
    const MAX_RAG_CONTEXT_CHARS = contextBudget;

    if (ragQuery.data?.nodes && ragQuery.data.nodes.length > 0) {
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
                  const truncated = `${entry.slice(0, remaining)}...`;
                  combinedContent += `${truncated}\n`;
                  ragDocuments.push({
                    ...doc,
                    summary: `${doc.summary.slice(
                      0,
                      remaining - doc.label.length - prefix.length - 5
                    )}...`,
                  });
                }
                break;
              }
              // Graph edge: try to squeeze it in or skip if literally no space
              if (currentLength + entry.length < MAX_RAG_CONTEXT_CHARS + 500) {
                // Allow small overflow for graph
                combinedContent += `${entry}\n`;
                currentLength += entry.length + 1;
                ragDocuments.push(doc);
              }
            } else {
              combinedContent += `${entry}\n`;
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
    effectiveWindowId,
  ]);
}
