import { ApiClient } from "../tui/api/client";
import { loadCredentials, storeToolAuthz } from "./credentials";

function getArgValue(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx === -1) {
    return null;
  }
  const next = args.at(idx + 1);
  return next && !next.startsWith("--") ? next : null;
}

function getMultiArgValue(args: string[], flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) {
      const next = args.at(i + 1);
      if (next && !next.startsWith("--")) {
        out.push(next);
      }
    }
  }
  return out;
}

function createClient(args: string[]): ApiClient {
  const baseUrl =
    getArgValue(args, "--base-url") ??
    process.env.ALFRED_WEB_URL ??
    "http://localhost:3000";
  return new ApiClient({ baseUrl });
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  const payload = parts[1];
  if (!payload) {
    return null;
  }

  // base64url → base64
  const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = `${base64}${"=".repeat(padLen)}`;

  try {
    const json = Buffer.from(padded, "base64").toString("utf8");
    const obj = JSON.parse(json);
    return obj && typeof obj === "object"
      ? (obj as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function decodeJwtExpMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp === "number" && Number.isFinite(exp)) {
    return Math.trunc(exp) * 1000;
  }
  return null;
}

function printHelp(): void {
  process.stdout.write(
    `${[
      "alfred token issue --scope <scope> [--scope <scope> ...] [--ttl <sec>] [--aud <aud>] [--name <name>] [--base-url <url>]",
      "alfred token elevate --scope <scope> [--scope <scope> ...] [--ttl <sec>] [--aud <aud>] [--name <name>] [--base-url <url>]",
      "alfred token show",
      "",
      "Issues and caches tool authz JWTs for executor operations.",
      "",
      "Tip: set `ALFRED_TOOL_AUTHZ` to override cached token.",
    ].join("\n")}\n`
  );
}

export async function handleTokenCommand(args: string[]): Promise<void> {
  const sub = args[0] ?? "";
  const help = args.includes("--help") || args.includes("-h");

  if (help || sub.length === 0) {
    printHelp();
    return;
  }

  if (sub === "show") {
    const creds = await loadCredentials();
    const tool = creds?.toolAuthz;
    if (!tool) {
      process.stdout.write("toolAuthz: null\n");
      return;
    }
    process.stdout.write(`tokenId: ${tool.tokenId ?? "unknown"}\n`);
    process.stdout.write(`elevated: ${tool.elevated}\n`);
    process.stdout.write(
      `issuedAt: ${new Date(tool.issuedAt).toISOString()}\n`
    );
    process.stdout.write(
      `expiresAt: ${
        typeof tool.expiresAt === "number"
          ? new Date(tool.expiresAt).toISOString()
          : "null"
      }\n`
    );
    process.stdout.write(`scopes: ${tool.scopes.join(",")}\n`);
    return;
  }

  const scopes = [
    ...getMultiArgValue(args, "--scope"),
    ...(getArgValue(args, "--scopes")
      ?.split(",")
      .map((s) => s.trim()) ?? []),
  ].filter((s) => s.length > 0);

  if (scopes.length === 0) {
    process.stderr.write("scopes_required\n");
    process.exitCode = 1;
    return;
  }

  const ttlRaw = getArgValue(args, "--ttl") ?? getArgValue(args, "--ttl-sec");
  const ttlSec =
    ttlRaw && Number.isFinite(Number(ttlRaw)) ? Number(ttlRaw) : undefined;

  const aud = getArgValue(args, "--aud") ?? undefined;
  const name = getArgValue(args, "--name") ?? undefined;

  const client = createClient(args);

  const issue = async (elevated: boolean) => {
    const res = elevated
      ? await client.tokenElevate({ aud, name, scopes, ttlSec })
      : await client.tokenIssue({ aud, name, scopes, ttlSec });

    if (res.error || !res.data) {
      process.stderr.write(`error: ${res.error?.code ?? "UNKNOWN"}\n`);
      process.stderr.write(`${res.error?.message ?? "token_issue_failed"}\n`);
      process.exitCode = 1;
      return;
    }

    const { token } = res.data;
    const issuedAt = Date.now();
    const expiresAt = decodeJwtExpMs(token);

    await storeToolAuthz({
      elevated,
      expiresAt,
      issuedAt,
      scopes,
      token,
      tokenId: res.data.tokenId,
    });

    process.stdout.write(`tokenId: ${res.data.tokenId}\n`);
    process.stdout.write(`elevated: ${elevated}\n`);
    process.stdout.write(
      `expiresAt: ${
        typeof expiresAt === "number"
          ? new Date(expiresAt).toISOString()
          : "null"
      }\n`
    );
    process.stdout.write(`scopes: ${scopes.join(",")}\n`);
    process.stdout.write(`token: ${token}\n`);
  };

  if (sub === "issue") {
    await issue(false);
    return;
  }

  if (sub === "elevate") {
    await issue(true);
    return;
  }

  printHelp();
}
