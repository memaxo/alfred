function cleanPart(part: string): string {
  const v = part.trim();
  if (v.length === 0) {
    throw new Error("pacerKey: empty part");
  }
  if (/\s/.test(v)) {
    throw new Error(`pacerKey: whitespace not allowed: ${v}`);
  }
  return v;
}

export function pacerKey(parts: readonly string[]): string {
  const cleaned = parts.map(cleanPart);
  return ["alfred", ...cleaned].join(".");
}
