import type * as chrono from "chrono-node";
import type nlp from "compromise";

/**
 * Type definitions for knowledge extraction
 */

export type ChronoResult = ReturnType<typeof chrono.parse>[number];

export type BaseView = ReturnType<typeof nlp>;

export type TextView = BaseView & {
  sentences(): TextView;
  people(): TextView;
  places(): TextView;
  organizations(): TextView;
  match(match: string): TextView;
  nouns(): TextView;
  verbs(): TextView;
  numbers(): TextView;
  questions(): TextView;
  has(match: string): boolean;
  clone(): TextView;
  toPositive(): TextView;
  text(): string;
  out(mode: "array"): string[];
  json(): unknown[];
  normalize(options?: { whitespace?: boolean; case?: boolean }): TextView;
};

export function asTextView(view: BaseView): TextView {
  return view as unknown as TextView;
}

export interface TermJson {
  text?: string;
  tags?: string[];
  index?: [number, number];
}

export interface SentenceJson {
  text?: string;
  terms?: TermJson[];
}

export interface VerbJson {
  terms?: TermJson[];
  verb?: {
    infinitive?: string;
    root?: string;
  };
  text?: string;
}

export interface NumberJson {
  number?: number;
  text?: string;
}

export type EntityKind = "person" | "place" | "organization" | "unknown";

export interface EntityMention {
  text: string;
  sentence: number;
  start: number;
  end: number;
}

export interface Entity {
  label: string;
  canonical: string;
  kind: EntityKind;
  confidence: number;
  mentions: EntityMention[];
  isPronoun?: boolean;
}

export interface RelationTriple {
  source: string;
  relation: string;
  target: string;
  sentence: number;
  evidence: string;
  confidence: number;
}

export interface Contradiction {
  pair: [string, string];
  reason: "negation" | "antonym" | "numeric";
  focus?: string;
  confidence: number;
}

export type TemporalPrecision = "year" | "month" | "day" | "time";

export interface TemporalExpression {
  raw: string;
  type: "instant" | "range" | "recurring";
  normalized: {
    start?: string;
    end?: string;
  };
  context: string;
  precision?: TemporalPrecision;
  recurrence?: string;
  confidence: number;
}

export interface ExtractedFact {
  content: string;
  confidence: number;
  source: string;
  entities: string[];
  relations: RelationTriple[];
}

export interface ExtractionResult {
  facts: ExtractedFact[];
  entities: Set<string>;
  entityDetails: Entity[];
  relations: RelationTriple[];
  contradictions: Contradiction[];
  temporal: TemporalExpression[];
  /** Detected topic domains (e.g., "Coding", "AI", "Security") */
  topics: string[];
  /** Whether text contains code blocks or code patterns */
  hasCodeBlock: boolean;
  /** Primary domain for this extraction */
  primaryDomain: string | null;
}

export interface MentionTerm {
  text: string;
  index?: [number, number];
  tags?: string[];
}

export interface MaybeMentionTerm {
  text?: string;
  index?: [number, number];
  tags?: string[];
}

export type MentionRecord = EntityMention & { entity: Entity };
