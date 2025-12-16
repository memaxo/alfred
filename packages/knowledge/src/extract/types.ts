import nlp from "compromise";
import type * as chrono from "chrono-node";

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

export const asTextView = (view: BaseView): TextView =>
  view as unknown as TextView;

export type TermJson = {
  text?: string;
  tags?: string[];
  index?: [number, number];
};

export type SentenceJson = {
  text?: string;
  terms?: TermJson[];
};

export type VerbJson = {
  terms?: TermJson[];
  verb?: {
    infinitive?: string;
    root?: string;
  };
  text?: string;
};

export type NumberJson = {
  number?: number;
  text?: string;
};

export type EntityKind = "person" | "place" | "organization" | "unknown";

export type EntityMention = {
  text: string;
  sentence: number;
  start: number;
  end: number;
};

export type Entity = {
  label: string;
  canonical: string;
  kind: EntityKind;
  confidence: number;
  mentions: EntityMention[];
  isPronoun?: boolean;
};

export type RelationTriple = {
  source: string;
  relation: string;
  target: string;
  sentence: number;
  evidence: string;
  confidence: number;
};

export type Contradiction = {
  pair: [string, string];
  reason: "negation" | "antonym" | "numeric";
  focus?: string;
  confidence: number;
};

export type TemporalPrecision = "year" | "month" | "day" | "time";

export type TemporalExpression = {
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
};

export type ExtractedFact = {
  content: string;
  confidence: number;
  source: string;
  entities: string[];
  relations: RelationTriple[];
};

export type ExtractionResult = {
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
};

export type MentionTerm = {
  text: string;
  index?: [number, number];
  tags?: string[];
};

export type MaybeMentionTerm = {
  text?: string;
  index?: [number, number];
  tags?: string[];
};

export type MentionRecord = EntityMention & { entity: Entity };

