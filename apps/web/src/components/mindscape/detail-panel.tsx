import type { inferRouterOutputs } from "@trpc/server";
import { Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type ArtifactData,
  type KnowledgeNodeData,
  useMindscapeStore,
} from "@/store/mindscape";
import { type TRPCAppRouter, trpc } from "@/utils/trpc";

type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
type ExplainedNode = RouterOutputs["graph"]["explainedBy"]["nodes"][number];
type ProvenanceCacheEntry = { nodes: ExplainedNode[]; cachedAt: number };
const PROVENANCE_CACHE_TTL_MS = 60_000;

function isKnowledgeData(
  data: ArtifactData | undefined
): data is KnowledgeNodeData & ArtifactData {
  return data?.type === "knowledge";
}

function getNodeLabel(node: { id: string; data?: ArtifactData } | undefined) {
  const data = node?.data;
  if (!data) {
    return node?.id ?? "Node";
  }
  const typed = data as Record<string, unknown>;
  const primaryLabel =
    typeof data.label === "string" && data.label.length > 0
      ? data.label
      : typeof typed.title === "string" && typed.title.length > 0
        ? (typed.title as string)
        : undefined;
  const fallbackLabel =
    typeof node?.id === "string" && node.id.length > 0 ? node.id : "Node";
  return primaryLabel ?? fallbackLabel;
}

function getDocTitle(doc: ExplainedNode) {
  const props = (doc.properties ?? {}) as Record<string, unknown>;
  const propTitle = props.title;
  if (typeof propTitle === "string" && propTitle.length > 0) {
    return propTitle;
  }
  const metadataTitle =
    props.metadata && typeof props.metadata === "object"
      ? (props.metadata as Record<string, unknown>).title
      : null;
  if (typeof metadataTitle === "string" && metadataTitle.length > 0) {
    return metadataTitle;
  }
  return doc.label;
}

type MindscapeDetailPanelProps = {
  onWorkflowNavigate?: (runId: string) => void;
  onWorkflowInspect?: (runId: string) => void;
};

export function MindscapeDetailPanel({
  onWorkflowNavigate,
  onWorkflowInspect,
}: MindscapeDetailPanelProps = {}) {
  const { focusedNodeId, nodes, focusNode } = useMindscapeStore(
    useShallow((state) => ({
      focusedNodeId: state.focusedNodeId,
      nodes: state.nodes,
      focusNode: state.focusNode,
    }))
  );

  const node = useMemo(
    () => nodes.find((candidate) => candidate.id === focusedNodeId),
    [nodes, focusedNodeId]
  );

  const data = node?.data as ArtifactData | undefined;
  const graphDbId =
    typeof data?.graph?.dbId === "string" ? data.graph.dbId : undefined;

  const isRuntimeKnowledge =
    isKnowledgeData(data) && (data.source === "runtime" || !data.source);
  const runId =
    isRuntimeKnowledge && typeof data?.runId === "string"
      ? data.runId
      : undefined;

  const runtimeGraphDbId = isRuntimeKnowledge ? (graphDbId ?? null) : null;
  const provenanceCacheRef = useRef<Map<string, ProvenanceCacheEntry>>(
    new Map()
  );
  const [debouncedGraphDbId, isDebouncing] = useDebouncedValue(
    runtimeGraphDbId,
    200
  );
  const memoizedEntry = debouncedGraphDbId
    ? provenanceCacheRef.current.get(debouncedGraphDbId)
    : undefined;
  const isMemoFresh = memoizedEntry
    ? Date.now() - memoizedEntry.cachedAt < PROVENANCE_CACHE_TTL_MS
    : false;

  const shouldQuery = Boolean(
    isRuntimeKnowledge && debouncedGraphDbId && !isMemoFresh
  );

  const {
    data: provenance,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.graph.explainedBy.useQuery(
    { reasoningNodeId: debouncedGraphDbId ?? "" },
    {
      enabled: shouldQuery,
      staleTime: 30_000,
      retry: 1,
    }
  );

  useEffect(() => {
    if (!debouncedGraphDbId) {
      return;
    }
    if (!provenance) {
      return;
    }
    provenanceCacheRef.current.set(debouncedGraphDbId, {
      nodes: provenance.nodes ?? [],
      cachedAt: Date.now(),
    });
  }, [debouncedGraphDbId, provenance]);

  const ragDocuments = provenance?.nodes ?? memoizedEntry?.nodes ?? [];
  const showLoadingState = Boolean(
    isRuntimeKnowledge &&
      !memoizedEntry &&
      (isDebouncing || (shouldQuery && isLoading))
  );

  const panelClasses =
    "pointer-events-auto absolute right-4 top-4 z-20 w-80 max-w-sm rounded-3xl border border-white/10 bg-void-surface/80 p-4 text-biolum shadow-2xl backdrop-blur";

  if (!node) {
    return (
      <aside className={panelClasses}>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-biolum text-sm tracking-wide">
            Node Inspector
          </p>
        </div>
        <p className="mt-4 text-biolum-dim text-sm">
          Focus a node to inspect its metadata and provenance.
        </p>
      </aside>
    );
  }

  return (
    <aside className={panelClasses}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-biolum-faint text-xs uppercase tracking-wide">
            {node.type}
          </p>
          <h2 className="font-semibold text-lg tracking-tight">
            {getNodeLabel(node)}
          </h2>
        </div>
        <button
          aria-label="Close inspector"
          className="rounded-full border border-transparent p-1 text-biolum-faint transition hover:border-white/10 hover:text-biolum"
          onClick={() => focusNode(null)}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <dl className="mt-4 space-y-2 text-biolum-faint text-xs">
        {isKnowledgeData(data) && (
          <div className="flex items-center justify-between">
            <dt>Source</dt>
            <dd className="text-biolum">{data.source ?? "runtime"}</dd>
          </div>
        )}
        {graphDbId && (
          <div className="flex items-center justify-between">
            <dt>Graph ID</dt>
            <dd className="font-mono text-[11px] text-biolum">
              {graphDbId.slice(0, 8)}…
            </dd>
          </div>
        )}
        {data?.graph?.hgHash && (
          <div className="flex items-center justify-between">
            <dt>Hypergraph Hash</dt>
            <dd className="font-mono text-[11px] text-biolum">
              {data.graph.hgHash.slice(0, 8)}…
            </dd>
          </div>
        )}
      </dl>

      {runId && (
        <section className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-biolum-faint text-xs uppercase tracking-wide">
                Workflow Run
              </p>
              <p className="font-medium text-biolum text-sm">
                {runId.slice(0, 12)}…
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button
                className="h-7 px-3 text-xs"
                data-testid="mindscape-workflow-link"
                onClick={() => {
                  if (onWorkflowInspect) {
                    onWorkflowInspect(runId);
                    return;
                  }
                  if (onWorkflowNavigate) {
                    onWorkflowNavigate(runId);
                    return;
                  }
                  if (typeof window !== "undefined") {
                    window.location.assign(`/workflow/${runId}`);
                  }
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                Inspect Workflow
              </Button>
              {onWorkflowNavigate && (
                <Button
                  className="h-6 px-2 text-[11px]"
                  data-testid="mindscape-workflow-open-full"
                  onClick={() => onWorkflowNavigate(runId)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Open full run
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      {isRuntimeKnowledge && (
        <section className="mt-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-300" />
            <h3 className="font-semibold text-sm tracking-tight">Provenance</h3>
          </div>
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
            {showLoadingState ? (
              <p className="flex items-center gap-2 text-biolum-dim text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading provenance…
              </p>
            ) : isError ? (
              <div className="space-y-2 text-sm">
                <p className="text-red-300">
                  Failed to load provenance: {error?.message ?? "Unknown error"}
                </p>
                <Button
                  className="h-7 px-3 text-xs"
                  onClick={() => void refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Retry
                </Button>
              </div>
            ) : ragDocuments.length === 0 ? (
              <p className="text-biolum-dim">No RAG documents linked.</p>
            ) : (
              <ul className="space-y-2">
                {ragDocuments.map((doc) => {
                  const ragNode = nodes.find(
                    (candidate) => candidate.data?.graph?.dbId === doc.id
                  );
                  return (
                    <li
                      className="rounded-xl border border-emerald-500/20 bg-emerald-600/5 p-2 text-emerald-100"
                      key={doc.id}
                    >
                      <p className="font-medium text-sm">
                        {getDocTitle(doc) ?? "RAG document"}
                      </p>
                      <p className="mt-1 text-emerald-200/70 text-xs">
                        {doc.id.slice(0, 8)}…
                      </p>
                      <Button
                        className={cn(
                          "mt-2 h-6 px-2 text-[11px]",
                          ragNode
                            ? "text-emerald-200 hover:text-emerald-100"
                            : "text-biolum-faint hover:text-biolum-faint"
                        )}
                        disabled={!ragNode}
                        onClick={() => {
                          if (ragNode) {
                            focusNode(ragNode.id);
                          }
                        }}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {ragNode ? "Focus document" : "Not on canvas"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}
    </aside>
  );
}

function useDebouncedValue<T>(value: T, delay: number): [T, boolean] {
  const [debounced, setDebounced] = useState(value);
  const [isDebouncing, setIsDebouncing] = useState(false);

  useEffect(() => {
    if (Object.is(value, debounced)) {
      setIsDebouncing(false);
      return;
    }
    setIsDebouncing(true);
    const handle = setTimeout(() => {
      setDebounced(value);
      setIsDebouncing(false);
    }, delay);
    return () => {
      clearTimeout(handle);
    };
  }, [value, delay, debounced]);

  return [debounced, isDebouncing];
}
