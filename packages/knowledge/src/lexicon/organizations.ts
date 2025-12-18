/**
 * Keywords indicating organizational entities.
 * Used to classify nouns that contain these substrings as organizations.
 */

export const ORG_KEYWORDS = [
  // Common suffixes
  "inc",
  "corp",
  "corporation",
  "labs",
  "limited",
  "ltd",
  "llc",
  "partners",
  "associates",
  "holdings",
  "enterprises",

  // International suffixes
  "ag",
  "bhd",
  "bv",
  "gk",
  "kk",
  "nv",
  "oy",
  "plc",
  "sa",
  "sarl",
  "se",
  "spa",
  "srl",
  "gmbh",

  // Educational institutions
  "university",
  "college",
  "school",

  // Organizational types
  "group",
  "team",
  "company",
  "committee",
  "department",
  "agency",
  "association",
  "foundation",
  "studio",
  "authority",
  "bank",
  "board",
  "bureau",
  "center",
  "centre",
  "charity",
  "church",
  "clinic",
  "club",
  "coalition",
  "consortium",
  "cooperative",
  "council",
  "credit",
  "district",
  "exchange",
  "federation",
  "firm",
  "forum",
  "guild",
  "hospital",
  "institute",
  "laboratory",
  "league",
  "library",
  "ministry",
  "museum",
  "network",
  "office",
  "organization",
  "partnership",
  "practice",
  "press",
  "registry",
  "service",
  "society",
  "syndicate",
  "theatre",
  "trust",
  "union",
  "venture",
] as const;

/**
 * Compromise tags that indicate organization entities.
 */
export const ORG_TAGS = new Set(["Organization", "Company", "Corporation"]);
