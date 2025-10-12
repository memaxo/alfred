/**
 * ALFRED Policy Loader
 */

import type { Rule } from "./rule";

export interface Policy {
  roles: Record<string, { scopes: string[] }>;
  rules?: Rule[];
  scopes: string[];
}

export async function loadPolicy(path: string): Promise<Policy> {
  // TODO: [Phase 9] Load policy from YAML file
  // - Parse YAML
  // - Validate structure with Zod
  // - Cache in memory
  throw new Error("Not implemented");
}
