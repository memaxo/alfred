export function sanitize<T extends Record<string, unknown>>(
  value: Partial<T>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      patch[key] = entry;
    }
  }
  return patch;
}
