export function adaptForVoice(text: string): string {
  return (
    text
      // Remove markdown formatting.
      .replaceAll(/[*_`#]/g, "")
      // Replace hyphens/underscores with spaces.
      .replaceAll(/[-_]/g, " ")
      // Remove parenthetical asides (often bad for TTS).
      .replaceAll(/\s*\([^)]*\)/g, "")
      // Collapse whitespace.
      .replaceAll(/\s+/g, " ")
      .trim()
  );
}
