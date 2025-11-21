const markers = new Map();
export function nowNs() {
  return process.hrtime.bigint();
}
export async function withBudget(_label, budgetMs, fn) {
  const start = nowNs();
  try {
    const result = await fn();
    const elapsedMs = Number(nowNs() - start) / 1_000_000;
    if (elapsedMs > budgetMs) {
    }
    return result;
  } catch (error) {
    const _elapsedMs = Number(nowNs() - start) / 1_000_000;
    throw error;
  }
}
export function mark(label) {
  markers.set(label, nowNs());
}
export function measure(startLabel, endLabel) {
  const start = markers.get(startLabel);
  if (!start) {
    return 0;
  }
  const end = endLabel ? (markers.get(endLabel) ?? nowNs()) : nowNs();
  const diff = end - start;
  return Number(diff) / 1_000_000;
}
export function markVoice(label) {
  mark(label);
}
