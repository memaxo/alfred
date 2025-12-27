import { openBrowser } from "./browser";
import { loadCredentials } from "./credentials";

const ADMIN_COMMANDS = [
  "admin.",
  "db.reset",
  "voice.restart",
  "deploy.prod",
  "token.elevate",
];

export function isAdminCommand(path: string): boolean {
  return ADMIN_COMMANDS.some((prefix) => path.startsWith(prefix));
}

export async function ensureBiometricForAdmin(
  sessionId: string
): Promise<void> {
  const API_URL = process.env.ALFRED_API_URL || "http://localhost:3000";

  // Check for biometric bypass in non-production environments
  const creds = await loadCredentials();
  const isLocal = creds?.isLocal || process.env.ALFRED_AUTH_BYPASS === "true";
  const canBypass =
    process.env.NODE_ENV !== "production" &&
    process.env.BIO_AUTH_BYPASS === "true";

  if (isLocal && canBypass) {
    return; // Allow bypass for local dev with BIO_AUTH_BYPASS enabled
  }

  // Check if we already have a valid biometric ticket by calling a lightweight admin procedure
  // We'll use a fetch to the tRPC endpoint directly for simplicity in this check
  const isBiometricValid = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/trpc/admin.getPerformanceStats?batch=1`,
        {
          headers: {
            "x-session-id": sessionId,
          },
        }
      );
      const data = (await response.json()) as unknown;
      // If it returns a result (not an error with biometric_required), it's valid
      return !(
        Array.isArray(data) &&
        data[0] &&
        typeof data[0] === "object" &&
        "error" in data[0] &&
        data[0].error &&
        typeof data[0].error === "object" &&
        "json" in data[0].error &&
        data[0].error.json &&
        typeof data[0].error.json === "object" &&
        "message" in data[0].error.json &&
        typeof data[0].error.json.message === "string" &&
        data[0].error.json.message.includes("biometric_required")
      );
    } catch {
      return false;
    }
  };

  if (await isBiometricValid()) {
    return;
  }

  // Open browser
  if (process.env.ALFRED_AUTO_OPEN_BROWSER !== "false") {
    try {
      await openBrowser(`${API_URL}/elevate?sessionId=${sessionId}`);
    } catch {}
  }

  // Poll for biometric ticket
  process.stdout.write("  Waiting for verification");

  const maxAttempts = 60; // 5 minutes at 5-second intervals
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(5000);
    process.stdout.write(".");

    if (await isBiometricValid()) {
      return;
    }
  }
  throw new Error("biometric_timeout");
}

export async function elevate(): Promise<void> {
  const creds = await loadCredentials();
  if (!creds) {
    throw new Error("tui_auth_required");
  }

  await ensureBiometricForAdmin(creds.sessionId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
