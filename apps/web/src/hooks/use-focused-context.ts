import type { ArtifactData } from "@/store/mindscape";
import { useMindscapeStore } from "@/store/mindscape";
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/utils/trpc";
import { useDebounce } from "@/hooks/use-debounce";

type ContextState = {
  content: string | null;
  nodeType: string | null;
  label: string | null;
  isLoading: boolean;
  isError: boolean;
  ragDocuments: Array<{ label: string; summary: string; source: "vector" | "graph" }>;
};

export function useFocusedContext(): ContextState {
  const focusedNodeId = useMindscapeStore((state) => state.focusedNodeId);
  const nodes = useMindscapeStore((state) => state.nodes);
  const edges = useMindscapeStore((state) => state.edges);
  
  const [localContext, setLocalContext] = useState<ContextState>({
    content: null,
    nodeType: null,
    label: null,
    isLoading: false,
    isError: false,
    ragDocuments: []
  });

  // Logic: If focused node is Chat, try to find a connected "Topic" node.
  // Otherwise, use the focused node itself.
  const effectiveNodeId = useMemo(() => {
    if (!focusedNodeId) return null;
    const node = nodes.find(n => n.id === focusedNodeId);
    if (!node) return null;

    if (node.type === 'chat') {
      // Look for connected edges
      const connectedEdge = edges.find(
        e => (e.source === focusedNodeId || e.target === focusedNodeId)
      );
      
      if (connectedEdge) {
        // Prioritize the *other* node
        const otherId = connectedEdge.source === focusedNodeId ? connectedEdge.target : connectedEdge.source;
        // Avoid jumping to another chat or orb if possible, but for now just take the first neighbor
        return otherId;
      }
    }
    return focusedNodeId;
  }, [focusedNodeId, nodes, edges]);

  const focusedNode = nodes.find((n) => n.id === effectiveNodeId);

  // 1. Extract local data from the node immediately
  useEffect(() => {
    if (!focusedNode) {
      setLocalContext({ content: null, nodeType: null, label: null, isLoading: false, isError: false, ragDocuments: [] });
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
       // Extract text from last 3 messages
       const recent = data.messages.slice(-3).map(m => {
           if (typeof m.content === 'string') return m.content;
           // Handle AI SDK v6 parts
           if (Array.isArray(m.content)) {
               return m.content
                .filter((p: any) => p.type === 'text')
                .map((p: any) => p.text)
                .join(' ');
           }
           return '';
       }).join('\n');
       content += `\nRecent Messages:\n${recent}`;
    }
    
    const title = "title" in data ? data.title : undefined;
    
    setLocalContext({
      content: content.trim() || null,
      nodeType: focusedNode.type || "unknown",
      label: (data.label || title || "Untitled") as string,
      isLoading: false,
      isError: false,
      ragDocuments: []
    });
    
  }, [focusedNode]);

  // 2. "Active RAG" - Fetch related context for complex nodes
  const shouldFetchRag = 
    focusedNode && 
    (focusedNode.type === 'knowledge' || focusedNode.type === 'concept') && 
    !!(focusedNode.data as any).label;

  const queryText = shouldFetchRag 
    ? ((focusedNode!.data as any).label + " " + ((focusedNode!.data as any).summary || "")) 
    : "";

  // Debounce the query text to prevent spamming the backend during rapid navigation
  const debouncedQueryText = useDebounce(queryText, 300);

  // Fetch model configuration to determine context budget
  const configQuery = trpc.assistant.getConfig.useQuery(undefined, {
    staleTime: Infinity, // Config rarely changes
  });

  // Calculate dynamic budget based on model context window (30% heuristic)
  const contextBudget = useMemo(() => {
    if (!configQuery.data) return 2000; // Safe default fallback
    // 30% of context window, converted to approx characters (1 token ~= 4 chars)
    // Example: 128k tokens * 0.3 * 4 = 153,600 chars
    return Math.floor(configQuery.data.contextWindow * 0.3 * 4);
  }, [configQuery.data]);

  // Dynamic topK: Aim to fill the budget. Assuming ~2000 chars per chunk (500 tokens).
  const targetTopK = Math.max(3, Math.ceil(contextBudget / 2000));

  const ragQuery = trpc.graph.runQuery.useQuery(
    {
      kind: "context",
      nodeId: focusedNodeId ?? "",
      text: debouncedQueryText,
      topK: Math.min(targetTopK, 50), 
    },
    {
      enabled: !!shouldFetchRag && debouncedQueryText.length > 0 && !!configQuery.data && !!focusedNodeId,
      staleTime: 1000 * 60 * 5, // Cache for 5 minutes
      retry: false,
    }
  );

  // Highlight graph edges involved in the context
  const setHighlightedEdges = useMindscapeStore((state) => state.setHighlightedEdges);
  useEffect(() => {
    if (ragQuery.data && ragQuery.data.edges) {
        const edgeIds = ragQuery.data.edges.map((e: any) => e.id);
        setHighlightedEdges(edgeIds);
    } else {
        setHighlightedEdges([]);
    }
  }, [ragQuery.data, setHighlightedEdges]);

  // 3. Merge local context with Active RAG results
  return useMemo(() => {
    if (!localContext.label) return localContext;

    let combinedContent = localContext.content || "";
    let ragDocuments: Array<{ label: string; summary: string; source: "vector" | "graph" }> = [];
    const MAX_RAG_CONTEXT_CHARS = contextBudget;
    
    if (ragQuery.data && ragQuery.data.nodes && ragQuery.data.nodes.length > 0) {
      const potentialDocs = ragQuery.data.nodes
        .filter((n: any) => n.id !== focusedNodeId) // Exclude self
        .map((n: any) => {
            const isGraph = n.kind === "link";
            let summary = "";
            if (isGraph) {
                const rel = n.properties?.relation || "related to";
                const dir = n.properties?.direction || "outgoing";
                summary = `(Graph Edge) ${dir === "incoming" ? "Is " + rel + " by" : rel} ${localContext.label}`;
            } else {
                summary = n.data?.summary || n.data?.content?.slice(0, 200) || "";
            }
            
            return { 
                label: n.label || n.data?.label || "Unknown", 
                summary,
                source: isGraph ? "graph" as const : "vector" as const 
            };
        });
      
      if (potentialDocs.length > 0) {
        let currentLength = combinedContent.length;
        const intro = `\n\n[Active RAG Context]\n`;
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
                             ragDocuments.push({ ...doc, summary: doc.summary.slice(0, remaining - doc.label.length - prefix.length - 5) + "..." });
                         }
                         break;
                     } else {
                         // Graph edge: try to squeeze it in or skip if literally no space
                         if (currentLength + entry.length < MAX_RAG_CONTEXT_CHARS + 500) { // Allow small overflow for graph
                             combinedContent += entry + "\n";
                             currentLength += entry.length + 1;
                             ragDocuments.push(doc);
                         }
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
      ragDocuments
    };
  }, [localContext, ragQuery.data, ragQuery.isLoading, ragQuery.isError, focusedNodeId, contextBudget]);
}
