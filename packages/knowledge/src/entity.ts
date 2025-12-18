/**
 * Entity label parsing utilities.
 */

/**
 * Parse an entity fact label in the format "[entity:type] label" or "(entity:type) label".
 * The parenthesis format handles sanitized labels where `sanitizeContextText()` normalizes brackets.
 *
 * @param label - The raw label string from a fact node
 * @returns Parsed entity type and label, or null if not an entity fact
 */
export function parseEntityFactLabel(
  label: string
): { entityType: string; label: string } | null {
  // Accept both raw and sanitized formats:
  // - "[entity:person] Alice"
  // - "(entity:person) Alice"
  const match = /^[[(]entity:([^\])]+)[\])]\s+(.+)$/.exec(label.trim());
  if (!match) {
    return null;
  }
  const entityType = match[1]?.trim();
  const entityLabel = match[2]?.trim();
  if (!(entityType && entityLabel)) {
    return null;
  }
  return { entityType, label: entityLabel };
}
