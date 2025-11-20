import {
  explanationDepthSchema,
  formatSchema,
  toneSchema,
  verbositySchema,
  type PreferenceDetail,
  type PreferenceKey,
} from "@alfred/type/preference";

type ResponseEnumSchema =
  | typeof verbositySchema
  | typeof toneSchema
  | typeof formatSchema
  | typeof explanationDepthSchema;

const RESPONSE_ENUM_SCHEMAS: Record<string, ResponseEnumSchema> = {
  "response.verbosity": verbositySchema,
  "response.tone": toneSchema,
  "response.format": formatSchema,
  "response.explanation_depth": explanationDepthSchema,
};

const MAX_STRING_LENGTH = 200;
const CONTROL_CHARS = /[\x00-\x1F\x7F-\x9F]/g;
const INJECTION_CHARS = /[<>\[\]{}\\]/g;

export function sanitizePreferences(
  preferences: Map<PreferenceKey, PreferenceDetail>
): Map<PreferenceKey, PreferenceDetail> {
  const sanitized = new Map<PreferenceKey, PreferenceDetail>();

  for (const [key, detail] of preferences) {
    const cleanValue = sanitizeValue(key, detail.value);
    if (cleanValue === undefined) {
      continue;
    }

    sanitized.set(key, {
      ...detail,
      value: cleanValue,
    });
  }

  return sanitized;
}

function sanitizeValue(
  key: PreferenceKey,
  value: PreferenceDetail["value"]
): PreferenceDetail["value"] | undefined {
  const schema = RESPONSE_ENUM_SCHEMAS[key];
  if (schema) {
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "string" ? sanitizeString(item) : item
    ) as PreferenceDetail["value"];
  }

  if (value && typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>);
  }

  return undefined;
}

function sanitizeString(value: string): string {
  return value
    .replace(CONTROL_CHARS, "")
    .replace(INJECTION_CHARS, "")
    .slice(0, MAX_STRING_LENGTH)
    .trim();
}

function sanitizeObject(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string" ? sanitizeString(item) : item
      );
    } else if (value && typeof value === "object") {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
