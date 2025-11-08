/**
 * PII Redaction Utility
 * Pure function to redact secrets and PII from logs and event data
 */

const SECRET_PATTERNS = [
  /(?:password|passwd|pwd|secret|token|key|api[_-]?key|auth[_-]?token|access[_-]?token)\s*[:=]\s*["']?([^\s"']{8,})["']?/gi,
  /(?:bearer|authorization)\s+([a-zA-Z0-9\-_]{20,})/gi,
  /(?:sk-|pk_)[a-zA-Z0-9]{32,}/gi,
  /[a-f0-9]{32,}/gi, // Long hex strings (likely hashes/tokens)
];

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

const PHONE_PATTERN = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;

const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

const CREDIT_CARD_PATTERN = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;

const REDACTION_MARKER = "[REDACTED]";

/**
 * Redacts secrets and PII from a string
 */
export function redactSecrets(text: string): string {
  let redacted = text;

  // Redact secrets
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, (match, group) => {
      if (group) {
        return match.replace(group, REDACTION_MARKER);
      }
      return REDACTION_MARKER;
    });
  }

  // Redact emails
  redacted = redacted.replace(EMAIL_PATTERN, REDACTION_MARKER);

  // Redact phone numbers
  redacted = redacted.replace(PHONE_PATTERN, REDACTION_MARKER);

  // Redact SSNs
  redacted = redacted.replace(SSN_PATTERN, REDACTION_MARKER);

  // Redact credit cards
  redacted = redacted.replace(CREDIT_CARD_PATTERN, REDACTION_MARKER);

  return redacted;
}

/**
 * Redacts secrets and PII from an object recursively
 */
export function redactObject(obj: unknown): unknown {
  if (typeof obj === "string") {
    return redactSecrets(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }

  if (obj && typeof obj === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip redaction for known safe fields
      if (
        key === "id" ||
        key === "runId" ||
        key === "userId" ||
        key === "workflowId" ||
        key === "eventType" ||
        key === "type" ||
        key === "timestamp" ||
        key === "createdAt" ||
        key === "updatedAt"
      ) {
        redacted[key] = value;
      } else {
        redacted[key] = redactObject(value);
      }
    }
    return redacted;
  }

  return obj;
}

/**
 * Redacts secrets from event data before persistence
 */
export function redactEventData(eventData: unknown): unknown {
  return redactObject(eventData);
}

