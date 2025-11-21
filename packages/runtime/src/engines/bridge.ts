import {
  empty as createHypergraph,
  fact as hyperFact,
  insight as hyperInsight,
  pattern as hyperPattern,
  relation as hyperRelation,
  nodeFromHash,
  type Hypergraph,
} from "@alfred/knowledge/hypergraph";
import type {
  KnowledgeFact,
  KnowledgeInsight,
  KnowledgeNode,
  KnowledgePattern,
  KnowledgeRelation,
  KnowledgeUpdate,
} from "@alfred/type/knowledge";
import { persistHypergraphToDb } from "@alfred/agent/assistant/hypergraph-bridge";

export interface RuntimeKnowledgeContext {
  resource: string;
  runId: string;
}

/**
 * RuntimeKnowledgeBridge
 *
 * Maintains an in-memory Hypergraph for a given runtime context
 * (identified by { runId, resource }) and applies canonical
 * KnowledgeUpdate records to that graph. Callers can then flush
 * the graph into the durable knowledge store via persist().
 */
export class RuntimeKnowledgeBridge {
  private readonly context: RuntimeKnowledgeContext;
  private readonly graph: Hypergraph;

  constructor(context: RuntimeKnowledgeContext, graph?: Hypergraph) {
    this.context = context;
    this.graph = graph ?? createHypergraph();
  }

  applyUpdates(updates: KnowledgeUpdate[]): void {
    if (updates.length === 0) {
      return;
    }
    for (const update of updates) {
      this.applyNode(update.node);
    }
  }

  getGraph(): Hypergraph {
    return this.graph;
  }

  /**
   * Persist the current hypergraph to the backing graph store.
   *
   * When DATABASE_URL is unset, the underlying bridge is a no-op,
   * which allows tests to exercise the LearningEngine in isolation.
   */
  async persist(): Promise<void> {
    await persistHypergraphToDb(this.graph, this.context.resource);
  }

  private applyNode(node: KnowledgeNode): void {
    if (isFact(node)) {
      this.addFact(node);
      return;
    }
    if (isInsight(node)) {
      this.addInsight(node);
      return;
    }
    if (isPattern(node)) {
      this.addPattern(node);
      return;
    }
    if (isRelation(node)) {
      this.addRelation(node);
    }
  }

  private addFact(node: KnowledgeFact): void {
    const confidence = Number(node.confidence ?? 0.8);
    this.graph.add(
      hyperFact(node.content, confidence, node.source ?? "runtime")
    );
  }

  private addInsight(node: KnowledgeInsight): void {
    const confidence = Number(node.confidence ?? 0.75);
    // Derived references are currently opaque IDs; we record the
    // aggregate insight and let future flows correlate derived nodes.
    this.graph.add(hyperInsight([], node.conclusion, confidence));
  }

  private addPattern(node: KnowledgePattern): void {
    const accuracy = Number(node.accuracy ?? 0.5);
    this.graph.add(hyperPattern([], node.rule, accuracy));
  }

  private addRelation(node: KnowledgeRelation): void {
    const from = nodeFromHash(node.from);
    const to = nodeFromHash(node.to);
    const weight =
      typeof node.weight === "number" && Number.isFinite(node.weight)
        ? node.weight
        : 1;
    this.graph.add(hyperRelation(from, to, node.kind, weight));
  }
}

function isFact(node: KnowledgeNode): node is KnowledgeFact {
  return "content" in node && "confidence" in node;
}

function isInsight(node: KnowledgeNode): node is KnowledgeInsight {
  return "conclusion" in node && "derived" in node;
}

function isPattern(node: KnowledgeNode): node is KnowledgePattern {
  return "examples" in node && "rule" in node;
}

function isRelation(node: KnowledgeNode): node is KnowledgeRelation {
  return "from" in node && "to" in node && "kind" in node;
}

