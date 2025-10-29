/**
 * Datalog-style Query Engine with Semantic Fallback
 * Pure functional query evaluation
 */

import type { Hypergraph, Knowledge, NodeId } from "./hypergraph.js"

// Query AST types
type Variable = string & { readonly _: unique symbol }
type Atom = string & { readonly _: unique symbol }

type Term = 
  | { _: "var"; name: Variable }
  | { _: "const"; value: string }
  | { _: "wildcard" }

type Clause = 
  | { _: "fact"; predicate: string; terms: Term[] }
  | { _: "relation"; subject: Term; predicate: string; object: Term }
  | { _: "filter"; variable: Variable; op: ">" | "<" | "=" | "!=" | "~"; value: string }

type Query = {
  find: Variable[]
  where: Clause[]
  limit?: number
}

type Binding = Map<Variable, string>
type Result = Map<Variable, string>

// Query parser (S-expression style for simplicity)
const variable = (name: string): Variable => name as Variable

/**
 * Parse Datalog-style query from string
 * Example: "find ?x where fact(?x, 'completed'), confidence(?x, > 0.8)"
 */
export const parse = (queryString: string): Query => {
  // TODO: Implement proper Datalog parser with full syntax support
  // Current regex approach doesn't handle:
  // - Nested expressions
  // - Aggregations (count, sum, avg)
  // - Negation (not exists)
  // - Recursive rules
  // Consider using PEG parser or ANTLR
  const findMatch = queryString.match(/find\s+([?]\w+(?:\s*,\s*[?]\w+)*)/i)
  const whereMatch = queryString.match(/where\s+(.+)/i)
  
  if (!findMatch || !whereMatch) {
    throw new Error("Invalid query format")
  }
  
  const find = findMatch[1]
    .split(",")
    .map(v => variable(v.trim()))
  
  const where = parseWhereClauses(whereMatch[1])
  
  return { find, where }
}

/**
 * Execute query against hypergraph
 */
export const execute = (query: Query, graph: Hypergraph): Result[] => {
  const results: Result[] = []
  const bindings = new Map<Variable, Set<string>>()
  
  // Initialize variable domains
  for (const clause of query.where) {
    initializeVariableDomains(clause, graph, bindings)
  }
  
  // Generate candidate solutions
  const candidates = generateCandidates(query.find, bindings)
  
  // Filter candidates that satisfy all clauses
  for (const candidate of candidates) {
    if (satisfiesAllClauses(candidate, query.where, graph)) {
      results.push(candidate)
      if (query.limit && results.length >= query.limit) {
        break
      }
    }
  }
  
  return results
}

/**
 * Semantic query fallback when exact match fails
 */
export const semanticQuery = (
  naturalLanguage: string, 
  graph: Hypergraph, 
  limit = 10
): NodeId[] => {
  // Extract key terms (simple approach)
  const terms = naturalLanguage
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t))
  
  // Score each node by term relevance
  const scores = new Map<NodeId, number>()
  
  // TODO: Implement node iteration on Hypergraph
  // Need to add iterator/generator method to traverse all nodes
  // Current implementation can't access graph nodes
  // Should also use inverted index for term lookup
  const nodes: Array<[NodeId, Knowledge]> = []
  
  // TODO: Implement proper semantic scoring
  // Current approach just counts term matches
  // Should:
  // - Use TF-IDF or BM25 scoring
  // - Consider term proximity
  // - Apply stemming/lemmatization
  // - Use embedding similarity from RTree
  for (const [id, node] of nodes) {
    let score = 0
    const content = getNodeContent(node).toLowerCase()
    
    for (const term of terms) {
      if (content.includes(term)) {
        score += 1
      }
    }
    
    if (score > 0) {
      scores.set(id, score)
    }
  }
  
  // Return top-k results
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)
}

/**
 * Pattern matching for complex queries
 */
export const match = (
  pattern: string,
  graph: Hypergraph
): Array<{ node: NodeId; bindings: Map<string, string> }> => {
  // TODO: Implement S-expression pattern matching
  // Should parse and evaluate patterns like:
  // - (and expr1 expr2) - logical AND
  // - (or expr1 expr2) - logical OR
  // - (not expr) - negation
  // - (exists var expr) - existential quantification
  // - (forall var expr) - universal quantification
  const matches: Array<{ node: NodeId; bindings: Map<string, string> }> = []
  
  return matches
}

// Helper functions

const parseWhereClauses = (whereString: string): Clause[] => {
  // TODO: Handle nested parentheses and complex expressions
  // Current regex fails on nested predicates like:
  // - member(?x, list(?y, ?z))
  // - distance(point(?x1, ?y1), point(?x2, ?y2), ?d)
  const clauses: Clause[] = []
  const clauseRegex = /(\w+)\(([^)]+)\)/g
  
  let match
  while ((match = clauseRegex.exec(whereString)) !== null) {
    const predicate = match[1]
    const args = match[2].split(",").map(a => a.trim())
    
    if (args.length === 1) {
      // Unary predicate
      clauses.push({
        _: "fact",
        predicate,
        terms: [parseTerm(args[0])]
      })
    } else if (args.length === 2) {
      // Binary predicate (relation)
      clauses.push({
        _: "relation",
        subject: parseTerm(args[0]),
        predicate,
        object: parseTerm(args[1])
      })
    } else if (args.length === 3 && ["<", ">", "=", "!=", "~"].includes(args[1])) {
      // Filter clause
      clauses.push({
        _: "filter",
        variable: variable(args[0]),
        op: args[1] as any,
        value: args[2].replace(/['"]/g, "")
      })
    }
  }
  
  return clauses
}

const parseTerm = (termString: string): Term => {
  if (termString === "_") {
    return { _: "wildcard" }
  } else if (termString.startsWith("?")) {
    return { _: "var", name: variable(termString) }
  } else {
    return { _: "const", value: termString.replace(/['"]/g, "") }
  }
}

const initializeVariableDomains = (
  clause: Clause,
  graph: Hypergraph,
  bindings: Map<Variable, Set<string>>
): void => {
  // TODO: Implement proper domain initialization
  // Should query graph indices to get actual possible values
  // Current implementation just creates empty sets
  // Need to:
  // - Query predicate index for matching facts
  // - Apply early filtering based on constants
  // - Use statistics for query optimization
  
  switch (clause._) {
    case "fact":
      for (const term of clause.terms) {
        if (term._ === "var" && !bindings.has(term.name)) {
          // TODO: Query graph.getFactsByPredicate(clause.predicate)
          bindings.set(term.name, new Set())
        }
      }
      break
      
    case "relation":
      if (clause.subject._ === "var" && !bindings.has(clause.subject.name)) {
        bindings.set(clause.subject.name, new Set())
      }
      if (clause.object._ === "var" && !bindings.has(clause.object.name)) {
        bindings.set(clause.object.name, new Set())
      }
      break
  }
}

const generateCandidates = (
  variables: Variable[],
  bindings: Map<Variable, Set<string>>
): Result[] => {
  // TODO: Implement constraint propagation algorithm
  // Current implementation returns empty array
  // Should:
  // - Generate cartesian product for small domains
  // - Use AC-3 algorithm for constraint propagation
  // - Apply forward checking to prune invalid combinations
  // - Order variables by domain size (MRV heuristic)
  const results: Result[] = []
  
  return results
}

const satisfiesAllClauses = (
  candidate: Result,
  clauses: Clause[],
  graph: Hypergraph
): boolean => {
  for (const clause of clauses) {
    if (!satisfiesClause(candidate, clause, graph)) {
      return false
    }
  }
  return true
}

const satisfiesClause = (
  binding: Result,
  clause: Clause,
  graph: Hypergraph
): boolean => {
  switch (clause._) {
    case "fact":
      // TODO: Actually check if fact exists in graph
      // Should query graph.get() with bound values
      // Current implementation always returns true
      return true
      
    case "relation":
      // TODO: Check if relation exists in graph
      // Should use graph.neighbors() or edge index
      // Current implementation always returns true
      return true
      
    case "filter":
      const value = binding.get(clause.variable)
      if (!value) return false
      
      switch (clause.op) {
        case ">": return parseFloat(value) > parseFloat(clause.value)
        case "<": return parseFloat(value) < parseFloat(clause.value)
        case "=": return value === clause.value
        case "!=": return value !== clause.value
        case "~": return value.includes(clause.value)
        default: return false
      }
  }
}

const getNodeContent = (node: Knowledge): string => {
  switch (node._) {
    case "fact": return node.content
    case "relation": return `${node.from} ${node.kind} ${node.to}`
    case "insight": return node.conclusion
    case "pattern": return node.rule
  }
}

// Stop words for semantic search
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for",
  "from", "has", "he", "in", "is", "it", "its", "of", "on",
  "that", "the", "to", "was", "will", "with"
])

/**
 * Query builder helper for common patterns
 */
export const builder = {
  facts: (predicate: string): Query => ({
    find: [variable("?x")],
    where: [{ _: "fact", predicate, terms: [{ _: "var", name: variable("?x") }] }]
  }),
  
  related: (from: string, relation: string): Query => ({
    find: [variable("?y")],
    where: [{
      _: "relation",
      subject: { _: "const", value: from },
      predicate: relation,
      object: { _: "var", name: variable("?y") }
    }]
  }),
  
  confident: (threshold: number): Query => ({
    find: [variable("?x")],
    where: [
      { _: "fact", predicate: "fact", terms: [{ _: "var", name: variable("?x") }] },
      { _: "filter", variable: variable("?x"), op: ">", value: threshold.toString() }
    ]
  })
}
