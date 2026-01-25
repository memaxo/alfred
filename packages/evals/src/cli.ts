import { issueAccessToken } from "@alfred/auth/token";

import { formatHelp, parseExecutorEvalsArgv } from "./config.js";
import { runExecutorEvals } from "./run.js";

function asAuthz(v: string): string {
  if (v.startsWith("Bearer ")) {
    return v;
  }
  return `Bearer ${v}`;
}

async function ensureAuthz(authz: string | undefined): Promise<string> {
  if (authz) {
    return asAuthz(authz);
  }
  const token = await issueAccessToken(
    "executor-evals",
    ["deploy.write", "droid.exec"],
    "alfred:tools",
    {
      elevated: true,
      mfa: "passkey",
    }
  );
  return `Bearer ${token}`;
}

export async function main(argv = Bun.argv.slice(2)): Promise<void> {
  let cfg;
  try {
    cfg = parseExecutorEvalsArgv(argv);
  } catch (error) {
    if (error instanceof Error && error.message === "help_requested") {
      process.stdout.write(formatHelp());
      return;
    }
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.stderr.write(formatHelp());
    process.exitCode = 2;
    return;
  }

  cfg.authz = await ensureAuthz(cfg.authz);

  const result = await runExecutorEvals(cfg);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
    );
    process.exit(1);
  });
}
