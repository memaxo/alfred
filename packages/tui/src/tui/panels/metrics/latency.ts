import type { RouterMetrics } from "../../subscriptions/metrics";
import { colors } from "../../theme";
import { bold, dim, fg, truncate } from "../../typography";

function padRight(s: string, n: number): string {
  if (s.length >= n) {
    return s;
  }
  return s + " ".repeat(n - s.length);
}

function padLeft(s: string, n: number): string {
  if (s.length >= n) {
    return s;
  }
  return " ".repeat(n - s.length) + s;
}

export function renderRouterLatencyTable(
  routers: RouterMetrics[],
  width: number
): string[] {
  const nameW = Math.max(8, Math.min(16, width - 30));
  const lines: string[] = [];

  lines.push(bold(dim("Router Latency")));
  lines.push(dim(`${padRight("  router", nameW + 2)}  p50   p99   avg  err`));
  lines.push(
    dim(`  ${"─".repeat(Math.max(0, Math.min(width - 4, nameW + 24)))}`)
  );

  for (const r of routers) {
    const name = padRight(truncate(r.name, nameW), nameW);
    const p50 = padLeft(`${Math.round(r.latency.p50)}ms`, 6);
    const p99 = padLeft(`${Math.round(r.latency.p99)}ms`, 6);
    const avg = padLeft(`${Math.round(r.latency.avg)}ms`, 6);
    const errRate = r.requests > 0 ? r.errors / r.requests : 0;
    const err = fg(
      errRate > 0.05
        ? colors.error
        : errRate > 0
          ? colors.warning
          : colors.muted
    )(padLeft(`${Math.round(errRate * 100)}%`, 4));
    lines.push(`  ${name}  ${p50} ${p99} ${avg}  ${err}`);
  }

  return lines.slice(
    0,
    Math.max(3, Math.min(lines.length, 2 + routers.length + 2))
  );
}

export type LatencyRow = {
  router: string;
  p50: number;
  p95?: number;
  p99: number;
};

export function renderLatency(rows: LatencyRow[], width: number): string[] {
  // Compatibility wrapper for legacy tests.
  const routers: RouterMetrics[] = rows.map((r) => ({
    name: r.router,
    requests: 1,
    errors: 0,
    latency: { p50: r.p50, p99: r.p99, avg: r.p95 ?? r.p50 },
  }));
  return renderRouterLatencyTable(routers, width);
}
