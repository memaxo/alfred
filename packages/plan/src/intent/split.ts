/**
 * detectSplits: Heuristically detect if an intent should be split
 */
export function detectSplits(input: string): string[] {
  const conjunctions = [" and ", " also ", " plus "];
  for (const conj of conjunctions) {
    if (input.includes(conj)) {
      return input.split(conj).map((s) => s.trim());
    }
  }
  return [input];
}
