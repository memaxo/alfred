/**
 * Verify a vllm-mlx OpenAI-compatible server.
 *
 * Usage:
 *   VLLM_MLX_BASE_URL=http://localhost:8000/v1 VLLM_MLX_API_KEY=... bun run scripts/verify-vllmmlx.ts
 *
 * Notes:
 * - `VLLM_MLX_BASE_URL` should include the `/v1` suffix (OpenAI base).
 * - If vllm-mlx was started with `--api-key`, provide `VLLM_MLX_API_KEY`.
 */
interface VerifyOpts {
  baseUrl: string;
  apiKey?: string;
  model: string;
}

function readEnvTrim(key: string): string | undefined {
  const v = process.env[key];
  if (!v) {
    return;
  }
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function normalizeBaseUrl(raw: string): URL {
  const url = new URL(raw);
  if (!url.pathname.endsWith("/v1") && !url.pathname.endsWith("/v1/")) {
    // If user passed http://host:8000, normalize to /v1.
    url.pathname = url.pathname.replace(/\/+$/, "") + "/v1";
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

function rootFromV1(base: URL): URL {
  const root = new URL(base.toString());
  root.pathname = root.pathname.replace(/\/v1$/, "");
  if (root.pathname.length === 0) {
    root.pathname = "/";
  }
  return root;
}

function buildHeaders(apiKey?: string): HeadersInit {
  if (!apiKey) {
    return { "content-type": "application/json" };
  }
  return {
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
  };
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`http_${res.status}: ${url} body=${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function parseArgs(argv: string[]): Partial<VerifyOpts> {
  const out: Partial<VerifyOpts> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base" && argv[i + 1]) {
      out.baseUrl = argv[i + 1]!;
      i++;
      continue;
    }
    if (a === "--key" && argv[i + 1]) {
      out.apiKey = argv[i + 1]!;
      i++;
      continue;
    }
    if (a === "--model" && argv[i + 1]) {
      out.model = argv[i + 1]!;
      i++;
      continue;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const baseRaw =
    args.baseUrl ??
    readEnvTrim("VLLM_MLX_BASE_URL") ??
    "http://localhost:8000/v1";
  const base = normalizeBaseUrl(baseRaw);
  const root = rootFromV1(base);

  const apiKey = args.apiKey ?? readEnvTrim("VLLM_MLX_API_KEY");
  const model = args.model ?? readEnvTrim("VLLM_MLX_MODEL") ?? "default";

  const headers = buildHeaders(apiKey);

  console.log(`vllm-mlx base: ${base.toString()}`);
  console.log(`vllm-mlx root: ${root.toString()}`);
  console.log(`model: ${model}`);
  console.log(`auth: ${apiKey ? "enabled" : "none"}`);

  console.log("\n== /health ==");
  console.log(
    await fetchJson(new URL("/health", root).toString(), {
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : undefined,
    })
  );

  console.log("\n== /v1/models ==");
  console.log(
    await fetchJson(new URL("/v1/models", root).toString(), { headers })
  );

  console.log("\n== /v1/chat/completions (non-stream) ==");
  const chat = await fetchJson(
    new URL("/v1/chat/completions", root).toString(),
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Say 'ok' and nothing else." }],
        temperature: 0,
        max_tokens: 8,
        stream: false,
      }),
    }
  );
  console.log(chat);

  console.log("\n✓ vllm-mlx checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
