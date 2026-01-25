import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { getPreferences, setPreference } from "@alfred/db/repo/user";
import { z } from "zod";

import { recordAssistantToolCall } from "../../../src/metrics";
import { invalidatePreferenceCache } from "../../../src/preference/loader";

const preferenceGetInputSchema = z.object({
  userId: z.string().min(1),
  key: z.string().optional(),
  domain: z.string().min(1).optional(),
  authz: z.string().optional(),
});

const preferenceSourceSchema = z.enum(["explicit", "inferred", "default"]);

const preferenceGetOutputSchema = z.object({
  preferences: z.array(
    z.object({
      key: z.string(),
      value: z.unknown(),
      confidence: z.number(),
      source: preferenceSourceSchema,
    })
  ),
});

type PreferenceGetInput = z.infer<typeof preferenceGetInputSchema>;

function mapSource(source: unknown): z.infer<typeof preferenceSourceSchema> {
  if (source === "user" || source === "assistant") {
    return "explicit";
  }
  if (source === "learned" || source === "inferred") {
    return "inferred";
  }
  return "default";
}

function matchesDomain(key: string, domain?: string) {
  if (!domain) {
    return true;
  }
  const prefix = `domain.${domain}.`;
  return key.startsWith(prefix);
}

export const toolPreferenceGet = {
  name: "preference_get",
  description: "Read user preferences, optionally filtered by key or domain.",
  inputSchema: preferenceGetInputSchema,
  outputSchema: preferenceGetOutputSchema,
  execute: async ({ input }: { input: PreferenceGetInput }) => {
    recordAssistantToolCall("preference_get");

    await requireToolScopesAndPolicy(input.authz, ["preference.read"], {
      action: "preference.read",
      resource: { kind: "preference", id: input.userId },
      context: {
        key: input.key,
        domain: input.domain,
      },
    });

    const rows = await getPreferences(input.userId);
    const list = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];

    const filtered = list
      .filter((row) => {
        const key = typeof row.key === "string" ? row.key : "";
        if (input.key && key !== input.key) {
          return false;
        }
        return matchesDomain(key, input.domain);
      })
      .map((row) => ({
        key: String(row.key ?? ""),
        value: row.value,
        confidence:
          typeof row.confidence === "number" && Number.isFinite(row.confidence)
            ? row.confidence
            : 1,
        source: mapSource(row.source),
      }))
      .filter((pref) => pref.key.length > 0)
      .sort((a, b) => a.key.localeCompare(b.key));

    return preferenceGetOutputSchema.parse({ preferences: filtered });
  },
};

const preferenceSetInputSchema = z.object({
  userId: z.string().min(1),
  key: z.string(),
  value: z.unknown(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.enum(["explicit", "inferred"]).optional(),
  authz: z.string().optional(),
});

const preferenceSetOutputSchema = z.object({
  updated: z.boolean(),
  key: z.string(),
  previousValue: z.unknown().optional(),
  newValue: z.unknown(),
});

type PreferenceSetInput = z.infer<typeof preferenceSetInputSchema>;

function toDbSource(source?: PreferenceSetInput["source"]) {
  return source === "inferred" ? "inferred" : "user";
}

export const toolPreferenceSet = {
  name: "preference_set",
  description: "Update a user preference value with a confidence score.",
  inputSchema: preferenceSetInputSchema,
  outputSchema: preferenceSetOutputSchema,
  execute: async ({ input }: { input: PreferenceSetInput }) => {
    recordAssistantToolCall("preference_set");

    await requireToolScopesAndPolicy(input.authz, ["preference.write"], {
      action: "preference.set",
      resource: { kind: "preference", id: input.userId },
      context: {
        key: input.key,
        source: input.source,
      },
    });

    const existing = await getPreferences(input.userId);
    const previous = Array.isArray(existing)
      ? (existing as { key?: unknown; value?: unknown }[]).find(
          (row) => row.key === input.key
        )?.value
      : undefined;

    await setPreference(
      input.userId,
      input.key,
      input.value,
      input.confidence ?? (input.source === "inferred" ? 0.8 : 1),
      toDbSource(input.source)
    );

    await invalidatePreferenceCache(input.userId);

    return preferenceSetOutputSchema.parse({
      updated: true,
      key: input.key,
      ...(previous !== undefined ? { previousValue: previous } : {}),
      newValue: input.value,
    });
  },
};

export type ToolPreferenceGet = typeof toolPreferenceGet;
export type ToolPreferenceSet = typeof toolPreferenceSet;
