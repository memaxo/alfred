 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }const markers = new Map();

export function nowNs() {
  return process.hrtime.bigint();
}

export async function withBudget(
  _label,
  budgetMs,
  fn
) {
  const start = nowNs();
  const result = await fn();
  const elapsedMs = Number(nowNs() - start) / 1000000;
  if (elapsedMs > budgetMs) {
  }
  return result;
}

export function mark(label) {
  markers.set(label, nowNs());
}

export function measure(startLabel, endLabel) {
  const start = markers.get(startLabel);
  if (!start) {
    return 0;
  }
  const end = endLabel ? (_nullishCoalesce(markers.get(endLabel), () => ( nowNs()))) : nowNs();
  const diff = end - start;
  return Number(diff) / 1000000;
}

 













export function markVoice(label) {
  mark(label);
}
