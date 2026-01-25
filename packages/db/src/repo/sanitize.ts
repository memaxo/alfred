const MAX_INPUT_LENGTH = 20_000;
const MAX_SANITIZED_LENGTH = 2000;

const INJECTION_PHRASES = [
  "ignore previous",
  "ignore all prior",
  "disregard above",
  "forget earlier",
  "forget everything",
  "reset the instructions",
  "stop following the instructions",
  "ignore this conversation",
  "override instructions",
];

const DELIMITER_TOKENS = [
  "[End Past Context]",
  "[Past Execution Context]",
  "[End Context]",
];

function removeAllCaseInsensitive(input: string, needle: string): string {
  if (!needle) {
    return input;
  }
  const lowerNeedle = needle.toLowerCase();
  const lower = input.toLowerCase();
  let i = 0;
  let last = 0;
  const out: string[] = [];
  while (true) {
    const idx = lower.indexOf(lowerNeedle, i);
    if (idx === -1) {
      break;
    }
    out.push(input.slice(last, idx));
    i = idx + needle.length;
    last = i;
  }
  if (out.length === 0) {
    return input;
  }
  out.push(input.slice(last));
  return out.join("");
}

function stripHtml(input: string): string {
  const s = input;
  const lower = s.toLowerCase();
  const out: string[] = [];

  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === undefined) {
      break;
    }
    if (ch !== "<") {
      out.push(ch);
      i += 1;
      continue;
    }

    // HTML comment: <!-- ... -->
    if (lower.startsWith("<!--", i)) {
      const end = lower.indexOf("-->", i + 4);
      i = end === -1 ? s.length : end + 3;
      continue;
    }

    // Parse tag name for block stripping.
    let j = i + 1;
    if (j < s.length && (s[j] === "/" || s[j] === "!")) {
      j += 1;
    }
    while (j < s.length) {
      const c = s[j];
      if (c === " " || c === "\n" || c === "\t" || c === "\r") {
        j += 1;
        continue;
      }
      break;
    }
    const nameStart = j;
    while (j < s.length) {
      const c = lower[j];
      if (c === undefined || c < "a" || c > "z") {
        break;
      }
      j += 1;
    }
    const tag = lower.slice(nameStart, j);
    const isClosing = lower.startsWith("</", i);

    // Block tags: remove tag + contents.
    if (
      !isClosing &&
      (tag === "script" ||
        tag === "style" ||
        tag === "iframe" ||
        tag === "object" ||
        tag === "embed")
    ) {
      const closeIdx = lower.indexOf(`</${tag}`, j);
      if (closeIdx === -1) {
        // No closing tag: skip until the end of this tag.
        const gt = lower.indexOf(">", j);
        i = gt === -1 ? s.length : gt + 1;
        continue;
      }
      const closeGt = lower.indexOf(">", closeIdx + 2 + tag.length);
      i = closeGt === -1 ? s.length : closeGt + 1;
      continue;
    }

    // Non-block tags: remove the tag itself.
    const gt = lower.indexOf(">", j);
    i = gt === -1 ? s.length : gt + 1;
  }

  return out.join("");
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

export function sanitizeContextText(text: string): string {
  if (!text) {
    return "";
  }

  const capped =
    text.length > MAX_INPUT_LENGTH ? text.slice(0, MAX_INPUT_LENGTH) : text;
  let cleaned = capped.replaceAll(/\r\n?/g, "\n");

  // XSS hardening: strip HTML tags and comments. (See docs/implementation/sanitize.md for rationale.)
  cleaned = stripHtml(cleaned);

  for (const token of DELIMITER_TOKENS) {
    cleaned = removeAllCaseInsensitive(cleaned, token);
  }

  cleaned = cleaned.replaceAll("[", "(").replaceAll("]", ")");

  // Remove randomized context delimiters produced by codex-learning.
  cleaned = removeAllCaseInsensitive(cleaned, "CONTEXT_START_");
  cleaned = removeAllCaseInsensitive(cleaned, "CONTEXT_END_");

  for (const phrase of INJECTION_PHRASES) {
    cleaned = removeAllCaseInsensitive(cleaned, phrase);
  }

  cleaned = cleaned.replaceAll(/[\t ]+/g, " ");
  cleaned = cleaned.replaceAll(/\n[ \t]+/g, "\n");
  cleaned = cleaned.replaceAll(/[ \t]+\n/g, "\n");
  cleaned = cleaned.replaceAll(/\n{3,}/g, "\n\n");

  cleaned = cleaned.trim();

  if (cleaned.length > MAX_SANITIZED_LENGTH) {
    cleaned = `${cleaned.slice(0, MAX_SANITIZED_LENGTH)}…`;
  }

  return cleaned;
}

export function sanitizeGraphValue<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeContextText(value) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeGraphValue(item)) as unknown as T;
  }

  if (value instanceof Date || value instanceof Uint8Array) {
    return value;
  }

  if (value && typeof value === "object") {
    if (!isPlainObject(value)) {
      return value;
    }
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      next[key] = sanitizeGraphValue(entry);
    }
    return next as unknown as T;
  }

  return value;
}
