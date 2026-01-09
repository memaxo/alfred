import { colors } from "../../theme";
import { bold, dim, fg, progressBar } from "../../typography";
import { sparkline } from "./sparklines";

export function renderRequestRate(
  rpm: number,
  history: number[],
  width: number
): string[] {
  const barWidth = Math.max(8, Math.min(26, width - 22));
  const target = 300;
  const frac = Math.max(0, Math.min(1, rpm / target));
  return [
    `${bold(dim("Requests"))}`,
    `  ${fg(colors.primary)(`${Math.round(rpm)} rpm`)} ${progressBar(frac, barWidth, { color: colors.primary })} ${dim(`(${history.length} samples)`)}`,
  ];
}

export function renderErrorRate(
  errorsPerMinute: number,
  requestsPerMinute: number,
  _latencyHistory: number[]
): string[] {
  const rate = requestsPerMinute > 0 ? errorsPerMinute / requestsPerMinute : 0;
  const color =
    rate > 0.05 ? colors.error : rate > 0 ? colors.warning : colors.success;
  return [
    `${bold(dim("Errors"))}`,
    `  ${fg(color)(`${Math.round(errorsPerMinute)} / min`)} ${dim(`(${Math.round(rate * 100)}%)`)}`,
  ];
}

export function renderConnections(
  activeConnections: number,
  _width: number
): string[] {
  const color = activeConnections > 25 ? colors.warning : colors.muted;
  return [
    `${bold(dim("Connections"))}`,
    `  ${fg(color)(String(activeConnections))} active`,
  ];
}

export function renderResourceUsage(
  memoryUsageMb: number,
  cpuPercent: number,
  width: number
): string[] {
  const barWidth = Math.max(8, Math.min(26, width - 22));
  const memFrac = Math.max(0, Math.min(1, memoryUsageMb / 1024));
  const cpuFrac = Math.max(0, Math.min(1, cpuPercent / 100));
  return [
    `${bold(dim("Resources"))}`,
    `  ${dim("CPU:")} ${progressBar(cpuFrac, barWidth, { color: colors.warning })} ${fg(colors.warning)(`${Math.round(cpuPercent)}%`)}`,
    `  ${dim("Mem:")} ${progressBar(memFrac, barWidth, { color: colors.primary })} ${fg(colors.primary)(`${Math.round(memoryUsageMb)}MB`)}`,
  ];
}

export function renderThroughputSummary(
  requestsPerMinute: number,
  errorsPerMinute: number
): string[] {
  const ok = errorsPerMinute === 0;
  const color = ok ? colors.success : colors.warning;
  return [
    `${bold(dim("Summary"))}`,
    `  ${fg(color)(ok ? "✓ healthy" : "⚠ degraded")} ${dim(`rpm=${Math.round(requestsPerMinute)} err/min=${Math.round(errorsPerMinute)}`)}`,
  ];
}

export function renderThroughputChart(
  values: number[],
  width: number
): string[] {
  const sparkWidth = Math.max(5, Math.min(30, width - 6));
  const s = sparkline(values, { width: sparkWidth, color: colors.primary });
  const last = values.at(-1) ?? 0;
  return [
    `${bold(dim("Throughput"))}`,
    `  ${s} ${dim(`${Math.round(last)} rpm`)}`,
  ];
}
