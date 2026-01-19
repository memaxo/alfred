export type HealthzResult =
  | { ok: true; latencyMs: number; body: { ok: true; ts?: number } }
  | {
      ok: false;
      latencyMs: number;
      status?: number;
      error: string;
      body?: unknown;
    };

export async function checkHealthz(
  baseUrl: string,
  opts?: { timeoutMs?: number }
): Promise<HealthzResult> {
  const timeoutMs = opts?.timeoutMs ?? 5000;
  const url = `${baseUrl.replace(/\/$/, "")}/healthz`;

  const controller = new AbortController();
  const startedAt = Date.now();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-store",
      },
    });
    const latencyMs = Date.now() - startedAt;
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        ok: false,
        latencyMs,
        status: res.status,
        error: "healthz_http_error",
        body: json,
      };
    }

    if (
      !json ||
      typeof json !== "object" ||
      !("ok" in (json as Record<string, unknown>)) ||
      (json as { ok?: unknown }).ok !== true
    ) {
      return {
        ok: false,
        latencyMs,
        status: res.status,
        error: "healthz_unexpected_body",
        body: json,
      };
    }

    return { ok: true, latencyMs, body: json as { ok: true; ts?: number } };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const msg = error instanceof Error ? error.message : String(error);
    const isAbort =
      (typeof DOMException !== "undefined" &&
        error instanceof DOMException &&
        error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError");
    return {
      ok: false,
      latencyMs,
      error: isAbort ? "healthz_timeout" : `healthz_fetch_failed:${msg}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
