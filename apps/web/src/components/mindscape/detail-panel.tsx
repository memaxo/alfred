import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Loader2, Sparkles, X } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMindscapeStore, type ArtifactData, type KnowledgeNodeData } from "@/store/mindscape";
import { trpc, type TRPCAppRouter } from "@/utils/trpc";

type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
type ExplainedNode = RouterOutputs["graph"]["explainedBy"]["nodes"][number];

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
  const metadataTitle = props.metadata && typeof props.metadata === "object"
    ? (props.metadata as Record<string, unknown>).title
    : null;
  if (typeof metadataTitle === "string" && metadataTitle.length > 0) {
    return metadataTitle;
  }
  return doc.label;
}

export function MindscapeDetailPanel() {
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
    isRuntimeKnowledge && typeof data?.runId === "string" ? data.runId : undefined;

  const {
    data: provenance,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.graph.explainedBy.useQuery(
    { reasoningNodeId: graphDbId ?? "" },
    {
      enabled: Boolean(isRuntimeKnowledge && graphDbId),
      staleTime: 30_000,
      retry: 1,
    }
  );

  const ragDocuments = provenance?.nodes ?? [];

  const panelClasses =
    "pointer-events-auto absolute right-4 top-4 z-20 w-80 max-w-sm rounded-3xl border border-white/10 bg-void-surface/80 p-4 text-biolum shadow-2xl backdrop-blur";

  if (!node) {
    return (
      <aside className={panelClasses}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold tracking-wide text-biolum">
            Node Inspector
          </p>
        </div>
        <p className="mt-4 text-sm text-biolum-dim">
          Focus a node to inspect its metadata and provenance.
        </p>
      </aside>
    );
  }

  return (
    <aside className={panelClasses}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-biolum-faint">
            {node.type}
          </p>
          <h2 className="text-lg font-semibold tracking-tight">
            {getNodeLabel(node)}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close inspector"
          className="rounded-full border border-transparent p-1 text-biolum-faint transition hover:border-white/10 hover:text-biolum"
          onClick={() => focusNode(null)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <dl className="mt-4 space-y-2 text-xs text-biolum-faint">
        {isKnowledgeData(data) && (
          <div className="flex items-center justify-between">
            <dt>Source</dt>
            <dd className="text-biolum">
              {data.source ?? "runtime"}
            </dd>
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
              <p className="text-xs uppercase tracking-wide text-biolum-faint">
                Workflow Run
              </p>
              <p className="text-biolum text-sm font-medium">
                {runId.slice(0, 12)}…
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 px-3 text-xs"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.assign(`/workflow/${runId}`);
                }
              }}
            >
              View Workflow
            </Button>
          </div>
        </section>
      )}

      {isRuntimeKnowledge && (
        <section className="mt-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-300" />
            <h3 className="text-sm font-semibold tracking-tight">
              Provenance
            </h3>
          </div>
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
            {isLoading ? (
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
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-xs"
                  onClick={() => void refetch()}
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
                      key={doc.id}
                      className="rounded-xl border border-emerald-500/20 bg-emerald-600/5 p-2 text-emerald-100"
                    >
                      <p className="text-sm font-medium">
                        {getDocTitle(doc) ?? "RAG document"}
                      </p>
                      <p className="mt-1 text-xs text-emerald-200/70">
                        {doc.id.slice(0, 8)}…
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
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
