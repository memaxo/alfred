import "bun";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import type { PolicyDocument } from "./types";
import { DEFAULT_POLICY_PATH } from "./types";

const policyConditionSchema = z.object({
  source: z.enum(["context"]).optional().default("context"),
  field: z.string(),
  equals: z.unknown().optional(),
  notEquals: z.unknown().optional(),
  in: z.array(z.unknown()).optional(),
  notIn: z.array(z.unknown()).optional(),
  exists: z.boolean().optional(),
});

const policyRuleSchema = z.object({
  id: z.string(),
  effect: z.enum(["allow", "deny"]).optional().default("allow"),
  actions: z.array(z.string()).nonempty(),
  roles: z.array(z.string()).optional(),
  resource: z
    .object({
      kind: z.string().optional(),
      ids: z.array(z.string()).optional(),
    })
    .optional(),
  conditions: z.array(policyConditionSchema).optional(),
  obligations: z.array(z.string()).optional(),
  description: z.string().optional(),
  priority: z.number().optional(),
});

const policyRoleSchema = z.object({
  scopes: z.array(z.string()).default([]),
});

const policyDocumentSchema = z.object({
  roles: z.record(policyRoleSchema).default({}),
  rules: z.array(policyRuleSchema).default([]),
  scopes: z.array(z.string()).default([]),
});

interface PolicyCache {
  path: string;
  mtimeMs: number;
  doc: PolicyDocument;
}

let cache: PolicyCache | null = null;

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

export async function loadPolicy(
  path: string = DEFAULT_POLICY_PATH
): Promise<PolicyDocument> {
  const resolvedPath = resolve(process.cwd(), path);
  const stats = await stat(resolvedPath);

  if (cache && cache.path === resolvedPath && cache.mtimeMs === stats.mtimeMs) {
    return cache.doc;
  }

  const raw = await Bun.file(resolvedPath).text();
  const parsed = policyDocumentSchema.parse(YAML.parse(raw) ?? {});

  const roles: PolicyDocument["roles"] = Object.fromEntries(
    Object.entries(parsed.roles).map(([role, value]) => [
      role,
      { scopes: dedupe(value.scopes) },
    ])
  );

  const doc: PolicyDocument = {
    roles,
    rules: parsed.rules.map((rule) => ({
      ...rule,
      obligations: rule.obligations ? dedupe(rule.obligations) : undefined,
    })),
    scopes: dedupe(parsed.scopes),
  };

  cache = {
    path: resolvedPath,
    mtimeMs: stats.mtimeMs,
    doc,
  };

  return doc;
}
