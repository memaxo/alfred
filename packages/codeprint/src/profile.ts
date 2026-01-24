/**
 * Profiling infrastructure for codeprint optimization.
 * Tracks timing for each stage of index build and query execution.
 */

export interface StageProfile {
  name: string;
  durationMs: number;
  count?: number;
  metadata?: Record<string, unknown>;
}

export interface IndexBuildProfile {
  totalMs: number;
  stages: {
    glob: StageProfile;
    read: StageProfile;
    parse: StageProfile;
    extract: StageProfile;
    persist: StageProfile;
  };
  files: {
    total: number;
    parsed: number;
    errors: number;
  };
  bytesRead: number;
}

export interface QueryProfile {
  totalMs: number;
  stages: {
    cacheCheck: StageProfile;
    tokenize: StageProfile;
    match: StageProfile;
    sort: StageProfile;
    rerankPrep: StageProfile;
    rerank: StageProfile;
    format: StageProfile;
  };
  result: {
    queryTerms: number;
    candidates: number;
    toRerank: number;
    returned: number;
    method: "keyword" | "rerank";
    cacheHit: boolean;
  };
}

export class Profiler {
  private stages: Map<
    string,
    { start: number; end?: number; metadata?: Record<string, unknown> }
  > = new Map();
  private counts: Map<string, number> = new Map();
  private startTime: number;

  constructor() {
    this.startTime = performance.now();
  }

  start(stage: string): void {
    this.stages.set(stage, { start: performance.now() });
  }

  end(stage: string, metadata?: Record<string, unknown>): number {
    const entry = this.stages.get(stage);
    if (!entry) {
      return 0;
    }
    entry.end = performance.now();
    if (metadata) {
      entry.metadata = metadata;
    }
    return entry.end - entry.start;
  }

  increment(counter: string, amount = 1): void {
    this.counts.set(counter, (this.counts.get(counter) ?? 0) + amount);
  }

  getStage(stage: string): StageProfile {
    const entry = this.stages.get(stage);
    if (!entry || !entry.end) {
      return { durationMs: 0, name: stage };
    }
    return {
      count: this.counts.get(stage),
      durationMs: entry.end - entry.start,
      metadata: entry.metadata,
      name: stage,
    };
  }

  getCount(counter: string): number {
    return this.counts.get(counter) ?? 0;
  }

  getTotalMs(): number {
    return performance.now() - this.startTime;
  }
}

// Global profiling state for aggregation
let profilingEnabled = process.env.CODEPRINT_PROFILE === "1";
const profiles: (IndexBuildProfile | QueryProfile)[] = [];

export function enableProfiling(): void {
  profilingEnabled = true;
}

export function disableProfiling(): void {
  profilingEnabled = false;
}

export function isProfilingEnabled(): boolean {
  return profilingEnabled;
}

export function recordProfile(profile: IndexBuildProfile | QueryProfile): void {
  if (profilingEnabled) {
    profiles.push(profile);
  }
}

export function getProfiles(): (IndexBuildProfile | QueryProfile)[] {
  return [...profiles];
}

export function clearProfiles(): void {
  profiles.length = 0;
}

export function getIndexBuildProfiles(): IndexBuildProfile[] {
  return profiles.filter((p): p is IndexBuildProfile => "files" in p);
}

export function getQueryProfiles(): QueryProfile[] {
  return profiles.filter((p): p is QueryProfile => "result" in p);
}

/**
 * Format profile for console output
 */
export function formatIndexBuildProfile(profile: IndexBuildProfile): string {
  const lines = [
    `Index Build Profile (${profile.totalMs.toFixed(1)}ms total)`,
    `  Files: ${profile.files.total} scanned, ${profile.files.parsed} parsed, ${profile.files.errors} errors`,
    `  Bytes: ${(profile.bytesRead / 1024 / 1024).toFixed(2)} MB`,
    ``,
    `  Stages:`,
    `    glob:    ${profile.stages.glob.durationMs.toFixed(1)}ms (${pct(profile.stages.glob.durationMs, profile.totalMs)})`,
    `    read:    ${profile.stages.read.durationMs.toFixed(1)}ms (${pct(profile.stages.read.durationMs, profile.totalMs)})`,
    `    parse:   ${profile.stages.parse.durationMs.toFixed(1)}ms (${pct(profile.stages.parse.durationMs, profile.totalMs)})`,
    `    extract: ${profile.stages.extract.durationMs.toFixed(1)}ms (${pct(profile.stages.extract.durationMs, profile.totalMs)})`,
    `    persist: ${profile.stages.persist.durationMs.toFixed(1)}ms (${pct(profile.stages.persist.durationMs, profile.totalMs)})`,
  ];
  return lines.join("\n");
}

export function formatQueryProfile(profile: QueryProfile): string {
  const lines = [
    `Query Profile (${profile.totalMs.toFixed(2)}ms total)`,
    `  Terms: ${profile.result.queryTerms}, Candidates: ${profile.result.candidates}, Returned: ${profile.result.returned}`,
    `  Method: ${profile.result.method}, Cache: ${profile.result.cacheHit ? "hit" : "miss"}`,
    ``,
    `  Stages:`,
    `    cacheCheck: ${profile.stages.cacheCheck.durationMs.toFixed(3)}ms`,
    `    tokenize:   ${profile.stages.tokenize.durationMs.toFixed(3)}ms`,
    `    match:      ${profile.stages.match.durationMs.toFixed(3)}ms`,
    `    sort:       ${profile.stages.sort.durationMs.toFixed(3)}ms`,
    `    rerankPrep: ${profile.stages.rerankPrep.durationMs.toFixed(3)}ms`,
    `    rerank:     ${profile.stages.rerank.durationMs.toFixed(3)}ms`,
    `    format:     ${profile.stages.format.durationMs.toFixed(3)}ms`,
  ];
  return lines.join("\n");
}

export function formatProfileSummary(): string {
  const indexProfiles = getIndexBuildProfiles();
  const queryProfiles = getQueryProfiles();

  if (indexProfiles.length === 0 && queryProfiles.length === 0) {
    return "No profiles recorded. Enable with CODEPRINT_PROFILE=1";
  }

  const lines: string[] = ["=== Codeprint Profile Summary ===", ""];

  if (indexProfiles.length > 0) {
    const avgIndex = averageIndexProfile(indexProfiles);
    lines.push(`Index Builds: ${indexProfiles.length}`);
    lines.push(formatIndexBuildProfile(avgIndex));
    lines.push("");
  }

  if (queryProfiles.length > 0) {
    const avgQuery = averageQueryProfile(queryProfiles);
    lines.push(`Queries: ${queryProfiles.length}`);
    lines.push(formatQueryProfile(avgQuery));
  }

  return lines.join("\n");
}

function pct(part: number, total: number): string {
  if (total === 0) {
    return "0%";
  }
  return `${((part / total) * 100).toFixed(1)}%`;
}

function averageIndexProfile(profiles: IndexBuildProfile[]): IndexBuildProfile {
  return {
    bytesRead: avg(profiles.map((p) => p.bytesRead)),
    files: {
      total: Math.round(avg(profiles.map((p) => p.files.total))),
      parsed: Math.round(avg(profiles.map((p) => p.files.parsed))),
      errors: Math.round(avg(profiles.map((p) => p.files.errors))),
    },
    stages: {
      glob: {
        name: "glob",
        durationMs: avg(profiles.map((p) => p.stages.glob.durationMs)),
      },
      read: {
        name: "read",
        durationMs: avg(profiles.map((p) => p.stages.read.durationMs)),
      },
      parse: {
        name: "parse",
        durationMs: avg(profiles.map((p) => p.stages.parse.durationMs)),
      },
      extract: {
        name: "extract",
        durationMs: avg(profiles.map((p) => p.stages.extract.durationMs)),
      },
      persist: {
        name: "persist",
        durationMs: avg(profiles.map((p) => p.stages.persist.durationMs)),
      },
    },
    totalMs: avg(profiles.map((p) => p.totalMs)),
  };
}

function averageQueryProfile(profiles: QueryProfile[]): QueryProfile {
  const keywordProfiles = profiles.filter((p) => p.result.method === "keyword");
  const rerankProfiles = profiles.filter((p) => p.result.method === "rerank");

  return {
    result: {
      queryTerms: Math.round(avg(profiles.map((p) => p.result.queryTerms))),
      candidates: Math.round(avg(profiles.map((p) => p.result.candidates))),
      toRerank: Math.round(avg(profiles.map((p) => p.result.toRerank))),
      returned: Math.round(avg(profiles.map((p) => p.result.returned))),
      method:
        keywordProfiles.length >= rerankProfiles.length ? "keyword" : "rerank",
      cacheHit:
        profiles.filter((p) => p.result.cacheHit).length > profiles.length / 2,
    },
    stages: {
      cacheCheck: {
        name: "cacheCheck",
        durationMs: avg(profiles.map((p) => p.stages.cacheCheck.durationMs)),
      },
      tokenize: {
        name: "tokenize",
        durationMs: avg(profiles.map((p) => p.stages.tokenize.durationMs)),
      },
      match: {
        name: "match",
        durationMs: avg(profiles.map((p) => p.stages.match.durationMs)),
      },
      sort: {
        name: "sort",
        durationMs: avg(profiles.map((p) => p.stages.sort.durationMs)),
      },
      rerankPrep: {
        name: "rerankPrep",
        durationMs: avg(profiles.map((p) => p.stages.rerankPrep.durationMs)),
      },
      rerank: {
        name: "rerank",
        durationMs: avg(profiles.map((p) => p.stages.rerank.durationMs)),
      },
      format: {
        name: "format",
        durationMs: avg(profiles.map((p) => p.stages.format.durationMs)),
      },
    },
    totalMs: avg(profiles.map((p) => p.totalMs)),
  };
}

function avg(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}
