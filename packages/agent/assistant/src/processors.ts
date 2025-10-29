import { Hypergraph } from "@alfred/knowledge";
import { extract, toKnowledge } from "@alfred/knowledge/extractor";
import { MemoryProcessor, type MemoryProcessorOpts } from "@mastra/core/memory";
import { recordMemoryUpdate } from "../../src/metrics";

type Message = {
  id?: string;
  role?: string;
  content?: unknown;
};

const graphs = new Map<string, Hypergraph>();
const processedMessages = new Map<string, Set<string>>();

function resolveResource(opts: MemoryProcessorOpts): string {
  const candidate = (opts as { resourceId?: string }).resourceId;
  if (typeof candidate === "string" && candidate.length > 0) {
    return candidate;
  }
  const scope = (opts as { scope?: string }).scope;
  const scopeId = (opts as { id?: string }).id ?? (opts as { scopeId?: string }).scopeId;
  return scopeId ?? scope ?? "default";
}

function getGraph(resourceId: string) {
  let graph = graphs.get(resourceId);
  if (!graph) {
    graph = new Hypergraph();
    graphs.set(resourceId, graph);
  }
  return graph;
}

function getProcessedSet(resourceId: string) {
  let set = processedMessages.get(resourceId);
  if (!set) {
    set = new Set();
    processedMessages.set(resourceId, set);
  }
  return set;
}

function extractText(message: Message): string | null {
  const { content } = message;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    const combined = content
      .map(part => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof (part as { text?: string }).text === "string") {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join(" ")
      .trim();
    return combined.length > 0 ? combined : null;
  }
  if (content && typeof content === "object") {
    const maybeText = (content as { text?: unknown }).text;
    if (typeof maybeText === "string" && maybeText.length > 0) {
      return maybeText;
    }
  }
  return null;
}

function makeMessageKey(message: Message, text: string) {
  if (typeof message.id === "string" && message.id.length > 0) {
    return message.id;
  }
  return `${message.role ?? "unknown"}:${text.slice(0, 48)}`;
}

export class PreferenceMemoryProcessor extends MemoryProcessor {
  constructor() {
    super({ name: "PreferenceMemoryProcessor" });
  }

  process(messages: any[], _opts: MemoryProcessorOpts): any[] {
    return messages;
  }
}

export class ToolDigestMemoryProcessor extends MemoryProcessor {
  constructor() {
    super({ name: "ToolDigestMemoryProcessor" });
  }

  process(messages: any[], opts: MemoryProcessorOpts): any[] {
    const resourceId = resolveResource(opts);
    const graph = getGraph(resourceId);
    const seen = getProcessedSet(resourceId);

    for (const entry of messages as Message[]) {
      if (!entry || (entry.role !== "user" && entry.role !== "assistant")) continue;
      const text = extractText(entry);
      if (!text) continue;

      const key = makeMessageKey(entry, text);
      if (seen.has(key)) continue;
      seen.add(key);

      const extraction = extract(text, entry.role);
      const nodes = toKnowledge(extraction, graph);
      for (const node of nodes) {
        graph.add(node);
        recordMemoryUpdate("knowledge", entry.role ?? "unknown");
      }
    }

    return messages;
  }
}
