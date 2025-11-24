/**
 * Datalog-style Query Engine with Semantic Fallback
 * Pure functional query evaluation (AC-3 + MRV backtracking)
 */

import nlp from "compromise";
import type { Hypergraph, Knowledge, NodeId } from "./hypergraph.js";
import { knn } from "./indices/knn.js";
import { measureSync } from "./metrics.js";
import { LRUCache } from "./util/lru.js";

// Query AST types
export type Variable = string & { readonly _: unique symbol };
// type Atom = string & { readonly _: unique symbol };

type Term =
  | { _: "var"; name: Variable }
  | { _: "const"; value: string }
  | { _: "wildcard" };

type Operator = ">" | "<" | "=" | "!=" | "~";

export type Clause =
  | { _: "fact"; predicate: string; terms: Term[] }
  | { _: "relation"; subject: Term; predicate: string; object: Term }
  | { _: "filter"; variable: Variable; op: Operator; value: string };

export type Query = {
  find: Variable[];
  where: Clause[];
  limit?: number;
};

export type Binding = Map<Variable, string>;
export type Result = Map<Variable, string>;
export type SemanticQueryOptions = {
  embedding?: Float32Array;
  maxKnnNodes?: number;
};

export type ReasoningNodeRecord = {
  id: string;
  hash: string;
  label: string;
  properties?: Record<string, unknown> | null;
};

export type ReasoningEdgeRecord = {
  fromId: string;
  toId: string;
  kind: string;
  metadata?: Record<string, unknown> | null;
};

export type ReasoningStep = {
  id: string;
  hash: string;
  text: string;
  index: number;
  timestamp: number | null;
  previousHash: string | null;
  nextHash: string | null;
  relations: Array<{ toId: string; kind: string; timeDelta: number | null }>;
};

type Domains = Map<Variable, Set<string>>;
type RelationClause = Extract<Clause, { _: "relation" }>;

type Arc = {
  from: Variable;
  to: Variable;
  clause: RelationClause;
  direction: "forward" | "backward";
};

type SerializedResult = [Variable, string][];

const CACHE = new LRUCache<string, SerializedResult[]>(512);
const QUERY_BUDGET_MS = 10;
const SEMANTIC_BUDGET_MS = 15;

// Query parser helpers
const variable = (name: string): Variable => name as Variable;

/**
 * Parse Datalog-style query from string
 * Example: "find ?x where fact(?x) and relates(?x, ?y)"
 */
export const parse = (queryString: string): Query => {
  const findMatch = queryString.match(/find\s+([?]\w+(?:\s*,\s*[?]\w+)*)/i);
  const whereMatch = queryString.match(/where\s+(.+)/i);

  if (!(findMatch && whereMatch)) {
    throw new Error("Invalid query format");
  }

  const find = findMatch[1].split(",").map((v) => variable(v.trim()));
  const where = parseWhereClauses(whereMatch[1]);

  return { find, where };
};

export const compile = (queryString: string): Query => {
  const parsed = parse(queryString);
  if (parsed.find.length === 0) {
    throw new Error("Query must declare at least one variable in find clause");
  }
  return parsed;
};

/**
 * Execute query against hypergraph with caching
 */
export const execute = (query: Query, graph: Hypergraph): Result[] =>
  measureSync("knowledge.query.execute", QUERY_BUDGET_MS, () =>
    executeInternal(query, graph)
  );

const executeInternal = (query: Query, graph: Hypergraph): Result[] => {
  const key = `${canonicalKey(query)}#v=${graph.version()}`;
  const cached = CACHE.get(key);
  if (cached) {
    return cached.map((entries) => new Map(entries));
  }

  const domains = initializeVariableDomains(query, graph);
  if (domains === null) {
    return [];
  }

  const candidates = generateCandidates(query, domains, graph);
  const limited =
    typeof query.limit === "number" && query.limit > 0
      ? candidates.slice(0, query.limit)
      : candidates;

  CACHE.set(
    key,
    limited.map((binding) => Array.from(binding.entries()))
  );

  return limited;
};

/**
 * Semantic query fallback when exact match fails
 */
export const semanticQuery = (
  naturalLanguage: string,
  graph: Hypergraph,
  limit = 10,
  options?: SemanticQueryOptions
): NodeId[] =>
  measureSync("knowledge.query.semantic", SEMANTIC_BUDGET_MS, () =>
    semanticQueryInternal(naturalLanguage, graph, limit, options)
  );

const semanticQueryInternal = (
  naturalLanguage: string,
  graph: Hypergraph,
  limit: number,
  options?: SemanticQueryOptions
): NodeId[] => {
  const seen = new Set<string>();
  const ordered: NodeId[] = [];

  const embedding = options?.embedding;
  const maxKnnNodes = options?.maxKnnNodes ?? 10_000;
  if (
    embedding &&
    graph.embeddingCount &&
    graph.embeddingCount() > 0 &&
    graph.embeddingCount() <= maxKnnNodes
  ) {
    const vectors = Array.from(graph.embeddingEntries()).map(([id, vec]) => ({
      id,
      vec,
    }));
    const knnResults = knn(vectors, embedding, limit);
    for (const id of knnResults) {
      const key = String(id);
      if (!seen.has(key)) {
        ordered.push(id);
        seen.add(key);
        if (ordered.length >= limit) {
          return ordered.slice(0, limit);
        }
      }
    }
  }

  const terms = extractQueryTerms(naturalLanguage);

  if (terms.length === 0) {
    return [];
  }

  const scores = new Map<NodeId, number>();
  for (const [id, node] of graph.entries()) {
    const content = getNodeContent(node).toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (content.includes(term)) {
        score += 1;
      }
    }
    if (score > 0) {
      scores.set(id, score);
    }
  }

  const textRanked = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  for (const id of textRanked) {
    const key = String(id);
    if (seen.has(key)) {
      continue;
    }
    ordered.push(id);
    seen.add(key);
    if (ordered.length >= limit) {
      break;
    }
  }

  return ordered.slice(0, limit);
};

/**
 * Pattern matching placeholder
 */
export const match = (
  pattern: string,
  graph: Hypergraph
): Array<{ node: NodeId; bindings: Map<string, string> }> => {
  void pattern;
  void graph;
  return [];
};

const parseWhereClauses = (whereString: string): Clause[] => {
  const clauses: Clause[] = [];
  const clauseRegex = /(\w+)\(([^)]+)\)/g;

  let match;
  while ((match = clauseRegex.exec(whereString)) !== null) {
    const predicate = match[1];
    const args = match[2].split(",").map((a) => a.trim());

    if (args.length === 1) {
      clauses.push({
        _: "fact",
        predicate,
        terms: [parseTerm(args[0])],
      });
    } else if (args.length === 2) {
      clauses.push({
        _: "relation",
        subject: parseTerm(args[0]),
        predicate,
        object: parseTerm(args[1]),
      });
    } else if (
      args.length === 3 &&
      ["<", ">", "=", "!=", "~"].includes(args[1])
    ) {
      clauses.push({
        _: "filter",
        variable: variable(args[0]),
        op: args[1] as Operator,
        value: args[2].replace(/["']/g, ""),
      });
    }
  }

  return clauses;
};

const parseTerm = (termString: string): Term => {
  if (termString === "_") {
    return { _: "wildcard" };
  }
  if (termString.startsWith("?")) {
    return { _: "var", name: variable(termString) };
  }
  return { _: "const", value: termString.replace(/["']/g, "") };
};

function initializeVariableDomains(
  query: Query,
  graph: Hypergraph
): Domains | null {
  const domains: Domains = new Map();
  const allNodes = getAllNodeIds(graph);
  const factNodes = getFactNodeIds(graph);

  const ensureDomain = (name: Variable): Set<string> => {
    let domain = domains.get(name);
    if (!domain) {
      domain = new Set(allNodes);
      domains.set(name, domain);
    }
    return domain;
  };

  const restrict = (name: Variable, allowed: Iterable<string>) => {
    const domain = ensureDomain(name);
    intersectDomain(domain, allowed);
  };

  for (const clause of query.where) {
    switch (clause._) {
      case "fact": {
        for (const term of clause.terms) {
          if (term._ === "var") {
            restrict(term.name, factNodes);
          }
        }
        break;
      }
      case "relation": {
        if (clause.subject._ === "var" && clause.object._ === "const") {
          const preds = graph
            .predecessorsByKind(asNodeId(clause.object.value), clause.predicate)
            .map(String);
          restrict(clause.subject.name, preds);
        }
        if (clause.object._ === "var" && clause.subject._ === "const") {
          const neighbors = graph
            .neighborsByKind(asNodeId(clause.subject.value), clause.predicate)
            .map(String);
          restrict(clause.object.name, neighbors);
        }
        if (clause.subject._ === "var" && !domains.has(clause.subject.name)) {
          ensureDomain(clause.subject.name);
        }
        if (clause.object._ === "var" && !domains.has(clause.object.name)) {
          ensureDomain(clause.object.name);
        }
        break;
      }
      case "filter": {
        ensureDomain(clause.variable);
        break;
      }
    }
  }

  for (const [, domain] of domains) {
    if (domain.size === 0) {
      return null;
    }
  }

  return domains;
}

function generateCandidates(
  query: Query,
  domains: Domains,
  graph: Hypergraph
): Result[] {
  applyAC3(domains, query.where, graph);

  const orderedVariables = Array.from(domains.entries())
    .sort((a, b) => a[1].size - b[1].size)
    .map(([name]) => name);

  const results: Result[] = [];
  const assignment: Result = new Map();

  const backtrack = (index: number) => {
    if (index === orderedVariables.length) {
      if (
        query.where.every((clause) =>
          clauseSatisfied(assignment, clause, graph, false)
        )
      ) {
        results.push(new Map(assignment));
      }
      return;
    }

    const variable = orderedVariables[index];
    if (!variable) {
      return;
    }
    const domain = domains.get(variable);
    if (!domain || domain.size === 0) {
      return;
    }

    for (const value of domain) {
      assignment.set(variable, value);
      const consistent = query.where.every((clause) =>
        clauseSatisfied(assignment, clause, graph, true)
      );
      if (consistent) {
        backtrack(index + 1);
      }
      assignment.delete(variable);
    }
  };

  backtrack(0);
  return results;
}

function applyAC3(
  domains: Domains,
  clauses: Clause[],
  graph: Hypergraph
): void {
  const arcs: Arc[] = [];
  const arcMap = new Map<Variable, Arc[]>();

  const enqueue = (arc: Arc) => {
    arcs.push(arc);
    if (!arcMap.has(arc.from)) {
      arcMap.set(arc.from, []);
    }
    arcMap.get(arc.from)?.push(arc);
  };

  for (const clause of clauses) {
    if (clause._ !== "relation") {
      continue;
    }
    if (clause.subject._ === "var" && clause.object._ === "var") {
      enqueue({
        from: clause.subject.name,
        to: clause.object.name,
        clause,
        direction: "forward",
      });
      enqueue({
        from: clause.object.name,
        to: clause.subject.name,
        clause,
        direction: "backward",
      });
    }
  }

  while (arcs.length > 0) {
    const arc = arcs.shift();
    if (!arc) {
      break;
    }
    if (reviseArc(arc, domains, graph)) {
      const neighbors = arcMap.get(arc.from) ?? [];
      for (const neighbor of neighbors) {
        if (neighbor.to !== arc.to) {
          arcs.push(neighbor);
        }
      }
    }
  }
}

function reviseArc(arc: Arc, domains: Domains, graph: Hypergraph): boolean {
  const source = domains.get(arc.from);
  const target = domains.get(arc.to);
  if (!(source && target && target.size > 0)) {
    return false;
  }

  let revised = false;
  for (const value of Array.from(source)) {
    const hasSupport = Array.from(target).some((candidate) =>
      relationSatisfiedForValues(value, candidate, arc, graph)
    );
    if (!hasSupport) {
      source.delete(value);
      revised = true;
    }
  }

  return revised;
}

function relationSatisfiedForValues(
  sourceVal: string,
  targetVal: string,
  arc: Arc,
  graph: Hypergraph
): boolean {
  if (arc.direction === "forward") {
    return relationSatisfied(
      asNodeId(sourceVal),
      asNodeId(targetVal),
      arc.clause,
      graph
    );
  }
  return relationSatisfied(
    asNodeId(targetVal),
    asNodeId(sourceVal),
    arc.clause,
    graph
  );
}

function relationSatisfied(
  subject: NodeId,
  object: NodeId,
  clause: RelationClause,
  graph: Hypergraph
): boolean {
  const neighbors = graph.neighborsByKind(subject, clause.predicate);
  return neighbors.some((neighbor) => String(neighbor) === String(object));
}

function clauseSatisfied(
  binding: Binding,
  clause: Clause,
  graph: Hypergraph,
  allowPartial: boolean
): boolean {
  switch (clause._) {
    case "fact": {
      const term = clause.terms[0];
      const value = resolveTerm(term, binding);
      if (!value) {
        return allowPartial;
      }
      const node = graph.get(asNodeId(value));
      return node?._ === "fact";
    }
    case "relation": {
      const subjectVal = resolveTerm(clause.subject, binding);
      const objectVal = resolveTerm(clause.object, binding);
      if (!(subjectVal && objectVal)) {
        return allowPartial;
      }
      return relationSatisfied(
        asNodeId(subjectVal),
        asNodeId(objectVal),
        clause,
        graph
      );
    }
    case "filter": {
      const value = binding.get(clause.variable);
      if (!value) {
        return allowPartial;
      }
      return filterPasses(asNodeId(value), clause, graph);
    }
  }
}

function filterPasses(
  nodeId: NodeId,
  clause: Extract<Clause, { _: "filter" }>,
  graph: Hypergraph
): boolean {
  const node = graph.get(nodeId);
  if (!node) {
    return false;
  }

  const numericValue =
    clause.op === "~" ? Number.NaN : Number.parseFloat(clause.value);
  switch (clause.op) {
    case ">":
      return getConfidence(node) > numericValue;
    case "<":
      return getConfidence(node) < numericValue;
    case "=":
      return getNodeContent(node) === clause.value;
    case "!=":
      return getNodeContent(node) !== clause.value;
    case "~":
      return getNodeContent(node).includes(clause.value);
    default:
      return false;
  }
}

const getConfidence = (node: Knowledge): number => {
  if (node._ === "fact" || node._ === "insight") {
    return Number(node.confidence);
  }
  if (node._ === "pattern") {
    return node.accuracy;
  }
  if (node._ === "relation") {
    return node.weight;
  }
  return 0;
};

const resolveTerm = (term: Term, binding: Binding): string | null => {
  if (term._ === "const") {
    return term.value;
  }
  if (term._ === "var") {
    return binding.get(term.name) ?? null;
  }
  return null;
};

const intersectDomain = (
  domain: Set<string>,
  allowed: Iterable<string>
): void => {
  const allowedSet = new Set(allowed);
  for (const value of Array.from(domain)) {
    if (!allowedSet.has(value)) {
      domain.delete(value);
    }
  }
};

const getAllNodeIds = (graph: Hypergraph): string[] => {
  const ids: string[] = [];
  for (const id of graph.ids()) {
    ids.push(String(id));
  }
  return ids;
};

const getFactNodeIds = (graph: Hypergraph): string[] => {
  const ids: string[] = [];
  for (const [id, node] of graph.entries()) {
    if (node._ === "fact") {
      ids.push(String(id));
    }
  }
  return ids;
};

const asNodeId = (value: string): NodeId => value as NodeId;

const canonicalKey = (query: Query): string => {
  const find = query.find.slice().sort().join(",");
  const where = query.where
    .map((clause) => JSON.stringify(clause))
    .sort()
    .join("|");
  return `${find}::${where}`;
};

const getNodeContent = (node: Knowledge): string => {
  switch (node._) {
    case "fact":
      return node.content;
    case "relation":
      return `${node.from} ${node.kind} ${node.to}`;
    case "insight":
      return node.conclusion;
    case "pattern":
      return node.rule;
  }
};

export function reconstructReasoningChain(
  nodes: ReasoningNodeRecord[],
  edges: ReasoningEdgeRecord[]
): ReasoningStep[] {
  const sorted = [...nodes].sort((a, b) => {
    const aIndex = readNumberProp(
      a.properties,
      "sequenceIndex",
      Number.MAX_SAFE_INTEGER
    );
    const bIndex = readNumberProp(
      b.properties,
      "sequenceIndex",
      Number.MAX_SAFE_INTEGER
    );
    if (aIndex !== null && bIndex !== null && aIndex !== bIndex) {
      return aIndex - bIndex;
    }
    const aTs = readNumberProp(
      a.properties,
      "timestamp",
      Number.MAX_SAFE_INTEGER
    );
    const bTs = readNumberProp(
      b.properties,
      "timestamp",
      Number.MAX_SAFE_INTEGER
    );
    if (aTs !== null && bTs !== null) {
      return aTs - bTs;
    }
    return 0;
  });

  const relations = new Map<
    string,
    Array<{ toId: string; kind: string; timeDelta: number | null }>
  >();
  for (const edge of edges) {
    const bucket = relations.get(edge.fromId) ?? [];
    bucket.push({
      toId: edge.toId,
      kind: edge.kind,
      timeDelta: readNumberProp(edge.metadata, "timeDelta", null),
    });
    relations.set(edge.fromId, bucket);
  }

  return sorted.map((node, index) => {
    const props = node.properties ?? {};
    return {
      id: node.id,
      hash: node.hash,
      text: node.label,
      index,
      timestamp: readNumberProp(props, "timestamp", null),
      previousHash: readStringProp(props, "previousHash", null),
      nextHash: readStringProp(props, "nextHash", null),
      relations: relations.get(node.id) ?? [],
    };
  });
}

function readNumberProp(
  props: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number | null
): number | null {
  if (!props) {
    return fallback;
  }
  const value = props[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function readStringProp(
  props: Record<string, unknown> | null | undefined,
  key: string,
  fallback: string | null
): string | null {
  if (!props) {
    return fallback;
  }
  const value = props[key];
  return typeof value === "string" ? value : fallback;
}

const extractQueryTerms = (naturalLanguage: string): string[] => {
  const doc = nlp(naturalLanguage);
  const unique = new Set<string>();

  const addTerms = (terms: string[]) => {
    for (const term of terms) {
      const normalized = term.trim().toLowerCase();
      if (normalized.length > 2) {
        unique.add(normalized);
      }
    }
  };

  addTerms(doc.nouns().out("array"));
  addTerms(doc.verbs().out("array"));
  addTerms(doc.people().out("array"));
  addTerms(doc.organizations().out("array"));
  addTerms(doc.topics().out("array"));

  return Array.from(unique);
};

export const builder = {
  facts: (predicate: string): Query => ({
    find: [variable("?x")],
    where: [
      {
        _: "fact",
        predicate,
        terms: [{ _: "var", name: variable("?x") }],
      },
    ],
  }),

  related: (from: string, relation: string): Query => ({
    find: [variable("?y")],
    where: [
      {
        _: "relation",
        subject: { _: "const", value: from },
        predicate: relation,
        object: { _: "var", name: variable("?y") },
      },
    ],
  }),

  confident: (threshold: number): Query => ({
    find: [variable("?x")],
    where: [
      {
        _: "fact",
        predicate: "fact",
        terms: [{ _: "var", name: variable("?x") }],
      },
      {
        _: "filter",
        variable: variable("?x"),
        op: ">",
        value: threshold.toString(),
      },
    ],
  }),
};
