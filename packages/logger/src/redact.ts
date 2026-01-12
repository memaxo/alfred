const REDACT = "[REDACTED]";

const secretKeyParts = [
  "token",
  "password",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "set-cookie",
  "session",
] as const;

function normKey(k: string): string {
  return k.toLowerCase();
}

export function shouldRedactKey(k: string): boolean {
  const nk = normKey(k);
  for (const part of secretKeyParts) {
    if (nk.includes(part)) {
      return true;
    }
  }
  return false;
}

export function redactValue(): string {
  return REDACT;
}
