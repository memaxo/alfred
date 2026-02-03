import "bun";
import { stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import YAML from "yaml";
import { z } from "zod";

import type { Obligation, PolicyDocument } from "./types";

import { DEFAULT_POLICY_PATH } from "./types";

const obligationObjectSchema = z.object({
  type: z.string().min(1),
  reason: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const obligationSchema = z.union([obligationObjectSchema, z.string().min(1)]);

const policyConditionSchema = z.object({
  source: z.enum(["context"]).optional().default("context"),
  field: z.string(),
  equals: z.unknown().optional(),
  notEquals: z.unknown().optional(),
  in: z.array(z.unknown()).optional(),
  notIn: z.array(z.unknown()).optional(),
  exists: z.boolean().optional(),
  gt: z.number().optional(),
  gte: z.number().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
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
  obligations: z.array(obligationSchema).optional(),
  description: z.string().optional(),
  priority: z.number().optional(),
});

const policyRoleSchema = z.object({
  scopes: z.array(z.string()).default([]),
});

const policyDocumentSchema = z.object({
  roles: z.record(z.string(), policyRoleSchema).default({}),
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
  return [...new Set(values)];
}

const legacyObligationPresets: Record<string, Obligation> = {
  requireBio: {
    type: "biometric",
    reason: "biometric_verification",
    metadata: { code: "requireBio", level: "passkey" },
  },
  requireManual: {
    type: "confirmation",
    reason: "manual_confirmation",
    metadata: { code: "requireManual" },
  },
  audit: {
    type: "confirmation",
    reason: "audit_acknowledgement",
    metadata: { code: "audit" },
  },
};

type RawObligation = z.infer<typeof obligationSchema>;

function normalizeObligation(raw: RawObligation): Obligation {
  if (typeof raw === "string") {
    const preset = legacyObligationPresets[raw];
    if (preset) {
      return { ...preset };
    }
    return {
      type: raw,
      reason: raw,
      metadata: { code: raw },
    };
  }
  return {
    type: raw.type,
    reason: raw.reason,
    metadata: raw.metadata ?? null,
  };
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([a], [b]) => (a > b ? 1 : a < b ? -1 : 0)
  );
  return `{${entries
    .map(([key, val]) => `${JSON.stringify(key)}:${stableSerialize(val)}`)
    .join(",")}}`;
}

function dedupeObligations(values: Obligation[]): Obligation[] {
  const seen = new Set<string>();
  const result: Obligation[] = [];
  for (const obligation of values) {
    const key = `${obligation.type}:${obligation.reason}:${stableSerialize(obligation.metadata ?? null)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(obligation);
  }
  return result;
}

/**
 * Searches for the policy file starting from the current directory
 * and moving up the tree until it finds one or reaches the root.
 */
async function findPolicyFile(path: string): Promise<string> {
  let currentDir = process.cwd();
  while (true) {
    const resolvedPath = resolve(currentDir, path);
    try {
      await stat(resolvedPath);
      return resolvedPath;
    } catch {
      const parentDir = dirname(currentDir);
      if (parentDir === currentDir) {
        // Reached root
        throw new Error(`Policy file not found: ${path}`);
      }
      currentDir = parentDir;
    }
  }
}

export async function loadPolicy(
  path: string = DEFAULT_POLICY_PATH
): Promise<PolicyDocument> {
  const resolvedPath = await findPolicyFile(path);
  const stats = await stat(resolvedPath);

  if (cache && cache.path === resolvedPath && cache.mtimeMs === stats.mtimeMs) {
    return cache.doc;
  }

  const raw = await Bun.file(resolvedPath).text();
  const parsed = policyDocumentSchema.parse(YAML.parse(raw) ?? {});

  const roles: PolicyDocument["roles"] = Object.fromEntries(
    Object.entries(parsed.roles).map(([role, value]) => {
      const roleData = value as z.infer<typeof policyRoleSchema>;
      return [role, { scopes: dedupe(roleData.scopes) }];
    })
  );

  const doc: PolicyDocument = {
    roles,
    rules: parsed.rules.map((rule) => {
      const obligations = rule.obligations
        ? dedupeObligations(
            rule.obligations.map((obligation) =>
              normalizeObligation(obligation)
            )
          )
        : undefined;
      return {
        ...rule,
        obligations,
      };
    }),
    scopes: dedupe(parsed.scopes),
  };

  cache = {
    path: resolvedPath,
    mtimeMs: stats.mtimeMs,
    doc,
  };

  return doc;
}
