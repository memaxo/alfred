const MAX_SANITIZED_LENGTH = 2000;
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+previous/gi,
  /ignore\s+all\s+prior/gi,
  /disregard\s+above/gi,
  /forget\s+(?:earlier|everything)/gi,
  /reset\s+the\s+instructions/gi,
  /override\s+.*instructions/gi,
  /stop\s+following\s+the\s+instructions/gi,
  /ignore\s+this\s+conversation/gi,
];
const DELIMITER_PATTERNS: RegExp[] = [
  /\[End Past Context]/gi,
  /\[Past Execution Context]/gi,
  /\[End Context]/gi,
  /\[End/gi,
  /\[Start/gi,
  /CONTEXT_START_[0-9a-f]+/gi,
  /CONTEXT_END_[0-9a-f]+/gi,
];

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const SCRIPT_TAG_RE = /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi;
const SCRIPT_SELF_CLOSING_RE = /<\s*script\b[^>]*\/\s*>/gi;
const BLOCKED_TAG_RE =
  /<\s*(iframe|embed|object)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const BLOCKED_TAG_SELF_CLOSING_RE = /<\s*(iframe|embed|object)\b[^>]*\/\s*>/gi;
const EVENT_HANDLER_ATTR_RE =
  /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL_ATTR_QUOTED_RE =
  /\b(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi;
const JS_URL_ATTR_UNQUOTED_RE = /\b(href|src)\s*=\s*javascript:[^\s>]+/gi;
const JS_URL_MARKDOWN_RE = /\]\(\s*javascript:[^)]+\)/gi;
const JAVASCRIPT_SCHEME_RE = /javascript\s*:/gi;

export function sanitizeContextText(text: string): string {
  if (!text) {
    return "";
  }

  let cleaned = text.replace(/\r\n?/g, "\n");

  cleaned = cleaned
    .replace(SCRIPT_TAG_RE, "")
    .replace(SCRIPT_SELF_CLOSING_RE, "")
    .replace(BLOCKED_TAG_RE, "")
    .replace(BLOCKED_TAG_SELF_CLOSING_RE, "")
    .replace(EVENT_HANDLER_ATTR_RE, "")
    .replace(JS_URL_ATTR_QUOTED_RE, '$1=""')
    .replace(JS_URL_ATTR_UNQUOTED_RE, '$1=""')
    .replace(JS_URL_MARKDOWN_RE, "]()")
    .replace(JAVASCRIPT_SCHEME_RE, "javascript");

  for (const pattern of DELIMITER_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  cleaned = cleaned
    .replace(/<!--/g, "(")
    .replace(/-->/g, ")")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")");

  for (const pattern of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  cleaned = cleaned.replace(/[\t ]+/g, " ");
  cleaned = cleaned.replace(/\n[ \t]+/g, "\n");
  cleaned = cleaned.replace(/[ \t]+\n/g, "\n");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

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
