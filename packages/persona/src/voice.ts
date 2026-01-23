export function adaptForVoice(text: string): string {
  return (
    text
      // Remove markdown formatting.
      .replace(/[*_`#]/g, "")
      // Replace hyphens/underscores with spaces.
      .replace(/[-_]/g, " ")
      // Remove parenthetical asides (often bad for TTS).
      .replace(/\s*\([^)]*\)/g, "")
      // Collapse whitespace.
      .replace(/\s+/g, " ")
      .trim()
  );
}

