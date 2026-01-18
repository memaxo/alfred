#!/usr/bin/env bun

/**
 * Rerank benchmark runner (HTTP).
 *
 * Measures end-to-end latency to the Qwen3-VL rerank microservice.
 * Optionally requests server stage timings (`--debug`) and a one-off cProfile dump (`--profile-once`).
 *
 * Example:
 *   bun scripts/bench-rerank.ts --base-url http://localhost:8200 --concurrency 4 --requests 50 --docs 20 --debug
 */

type Args = {
  baseUrl: string;
  concurrency: number;
  requests: number;
  docs: number;
  topN: number;
  debug: boolean;
  profileOnce: boolean;
  multimodalRatio: number;
  image?: string;
  timeoutMs: number;
};

function parseIntArg(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFloatArg(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp01(n: number): number {
  if (n < 0) {
    return 0;
  }
  if (n > 1) {
    return 1;
  }
  return n;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    if (idx === -1) {
      return;
    }
    return argv[idx + 1];
  };
  const has = (flag: string): boolean => argv.includes(flag);

  const baseUrl =
    get("--base-url") ??
    process.env.QWEN3VL_RERANK_URL ??
    "http://localhost:8200";

  const concurrency = parseIntArg(get("--concurrency"), 4);
  const requests = parseIntArg(get("--requests"), 50);
  const docs = parseIntArg(get("--docs"), 20);
  const topN = parseIntArg(get("--top-n"), 10);
  const timeoutMs = parseIntArg(get("--timeout-ms"), 120_000);

  const multimodalRatio = clamp01(parseFloatArg(get("--multimodal-ratio"), 0));
  const image = get("--image") ?? process.env.RERANK_BENCH_IMAGE;

  return {
    baseUrl: baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl,
    concurrency: Math.max(1, concurrency),
    requests: Math.max(1, requests),
    docs: Math.max(1, docs),
    topN: Math.max(1, topN),
    debug: has("--debug"),
    profileOnce: has("--profile-once"),
    multimodalRatio,
    image: image && image.length > 0 ? image : undefined,
    timeoutMs: Math.max(1000, timeoutMs),
  };
}

function usage(): string {
  return [
    "Rerank benchmark (HTTP)",
    "",
    "Usage:",
    "  bun scripts/bench-rerank.ts --base-url http://localhost:8200 --concurrency 4 --requests 50 --docs 20",
    "",
    "Options:",
    "  --base-url          Rerank server base URL (default: http://localhost:8200)",
    "  --concurrency       Concurrent in-flight requests (default: 4)",
    "  --requests          Total requests (default: 50)",
    "  --docs              Documents per request (default: 20)",
    "  --top-n             top_n (default: 10)",
    "  --debug             Ask server to include stage timings in response",
    "  --profile-once      Ask server to write one cProfile dump for request #0",
    "  --multimodal-ratio  Fraction of docs with images (0..1, default: 0)",
    "  --image             Image URL or local path (local path is converted to file://)",
    "  --timeout-ms        Hard timeout for the run (default: 120000)",
  ].join("\n");
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const v of values) {
    sum += v;
  }
  return sum / values.length;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(p * (sorted.length - 1)))
  );
  return sorted[idx] ?? 0;
}

type StageSample = {
  build_query_ms: number;
  split_docs_ms: number;
  text_only_ms: number;
  multimodal_ms: number;
  sort_ms: number;
  total_ms: number;
};

function toFileUrlMaybe(pathOrUrl: string): string {
  if (
    pathOrUrl.startsWith("http://") ||
    pathOrUrl.startsWith("https://") ||
    pathOrUrl.startsWith("file://")
  ) {
    return pathOrUrl;
  }
  // absolute path expected; keep it simple
  return `file://${pathOrUrl}`;
}

function buildDocs(
  args: Args
): Array<{ id: string; text: string; image?: string }> {
  const docs: Array<{ id: string; text: string; image?: string }> = [];
  const mmEvery =
    args.multimodalRatio > 0
      ? Math.max(1, Math.floor(1 / args.multimodalRatio))
      : 0;
  const image = args.image ? toFileUrlMaybe(args.image) : undefined;

  for (let i = 0; i < args.docs; i++) {
    const isMm = Boolean(image) && mmEvery > 0 && i % mmEvery === 0;
    if (isMm) {
      docs.push({
        id: `doc-${i}`,
        text: `UI design document #${i} (contains an image).`,
        image,
      });
      continue;
    }
    const topic = i % 3 === 0 ? "machine learning" : "weather";
    docs.push({ id: `doc-${i}`, text: `Document #${i} about ${topic}.` });
  }
  return docs;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    // eslint-disable-next-line no-console
    console.log(usage());
    return;
  }

  const args = parseArgs(argv);
  const docs = buildDocs(args);

  const latenciesMs: number[] = [];
  const stages: StageSample[] = [];
  const errors: string[] = [];

  let next = 0;
  const startedAt = performance.now();

  const worker = async (workerId: number) => {
    while (true) {
      const idx = next;
      if (idx >= args.requests) {
        break;
      }
      next += 1;

      const profile = args.profileOnce && idx === 0;
      const start = performance.now();
      try {
        const response = await fetch(`${args.baseUrl}/rerank`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query: { text: "machine learning algorithms" },
            documents: docs,
            top_n: args.topN,
            debug: args.debug,
            profile,
          }),
        });
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(`http_${response.status}:${body.slice(0, 200)}`);
        }
        const body = (await response.json()) as unknown;
        const elapsed = performance.now() - start;
        latenciesMs.push(elapsed);

        if (args.debug && typeof body === "object" && body !== null) {
          const dbg = (body as { debug?: unknown }).debug;
          if (dbg && typeof dbg === "object") {
            const o = dbg as Record<string, unknown>;
            const sample: StageSample = {
              build_query_ms: Number(o.build_query_ms ?? 0),
              split_docs_ms: Number(o.split_docs_ms ?? 0),
              text_only_ms: Number(o.text_only_ms ?? 0),
              multimodal_ms: Number(o.multimodal_ms ?? 0),
              sort_ms: Number(o.sort_ms ?? 0),
              total_ms: Number(o.total_ms ?? 0),
            };
            stages.push(sample);
          }
        }
      } catch (error) {
        const msg =
          error instanceof Error
            ? error.message
            : `unknown_error:${String(error)}`;
        if (errors.length < 25) {
          errors.push(`worker=${workerId} req=${idx} ${msg}`);
        }
      }
    }
  };

  const timeout = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error(
      `\n[FATAL] rerank bench timed out after ${args.timeoutMs}ms (increase --timeout-ms)`
    );
    setTimeout(() => process.exit(124), 10);
  }, args.timeoutMs);
  timeout.unref?.();

  await Promise.all(
    Array.from({ length: args.concurrency }, (_, i) => worker(i))
  ).finally(() => clearTimeout(timeout));

  const durationMs = performance.now() - startedAt;
  const total = args.requests;
  const ok = latenciesMs.length;
  const failed = total - ok;
  const seconds = durationMs / 1000;
  const rps = seconds > 0 ? total / seconds : 0;

  const avg = mean(latenciesMs);
  const p50 = percentile(latenciesMs, 0.5);
  const p95 = percentile(latenciesMs, 0.95);
  const p99 = percentile(latenciesMs, 0.99);
  const max = percentile(latenciesMs, 1);

  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log("rerank bench results");
  // eslint-disable-next-line no-console
  console.log(`- baseUrl: ${args.baseUrl}`);
  // eslint-disable-next-line no-console
  console.log(`- concurrency: ${args.concurrency}`);
  // eslint-disable-next-line no-console
  console.log(`- requests: ${args.requests}`);
  // eslint-disable-next-line no-console
  console.log(`- docs: ${args.docs}`);
  // eslint-disable-next-line no-console
  console.log(`- debug: ${args.debug}`);
  // eslint-disable-next-line no-console
  console.log(`- ok: ${ok}`);
  // eslint-disable-next-line no-console
  console.log(`- failed: ${failed}`);
  // eslint-disable-next-line no-console
  console.log(`- durationMs: ${Math.round(durationMs)}`);
  // eslint-disable-next-line no-console
  console.log(`- rps: ${rps.toFixed(2)}`);
  // eslint-disable-next-line no-console
  console.log(
    `- latencyMs: avg=${avg.toFixed(1)} p50=${p50.toFixed(1)} p95=${p95.toFixed(
      1
    )} p99=${p99.toFixed(1)} max=${max.toFixed(1)}`
  );

  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.log("");
    // eslint-disable-next-line no-console
    console.log("sample errors (first 25):");
    for (const e of errors) {
      // eslint-disable-next-line no-console
      console.log(`- ${e}`);
    }
  }

  if (args.debug && stages.length > 0) {
    const stage = (k: keyof StageSample) => stages.map((s) => s[k]);
    const fmt = (values: number[]) =>
      `avg=${mean(values).toFixed(1)} p95=${percentile(values, 0.95).toFixed(1)}`;

    // eslint-disable-next-line no-console
    console.log("");
    // eslint-disable-next-line no-console
    console.log("server stage timings (ms)");
    // eslint-disable-next-line no-console
    console.log(`- build_query_ms: ${fmt(stage("build_query_ms"))}`);
    // eslint-disable-next-line no-console
    console.log(`- split_docs_ms: ${fmt(stage("split_docs_ms"))}`);
    // eslint-disable-next-line no-console
    console.log(`- text_only_ms: ${fmt(stage("text_only_ms"))}`);
    // eslint-disable-next-line no-console
    console.log(`- multimodal_ms: ${fmt(stage("multimodal_ms"))}`);
    // eslint-disable-next-line no-console
    console.log(`- sort_ms: ${fmt(stage("sort_ms"))}`);
    // eslint-disable-next-line no-console
    console.log(`- total_ms: ${fmt(stage("total_ms"))}`);
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await main();
}
