export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  if (!Number.isFinite(diff)) {
    return date.toLocaleString();
  }
  const abs = Math.abs(diff);
  if (abs < 60_000) {
    return "just now";
  }
  if (abs < 3_600_000) {
    const minutes = Math.round(abs / 60_000);
    return `${minutes}m ago`;
  }
  if (abs < 86_400_000) {
    const hours = Math.round(abs / 3_600_000);
    return `${hours}h ago`;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
