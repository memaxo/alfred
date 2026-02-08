import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

interface PkgInfo {
  dirName: string;
  name: string;
  short: string;
}

interface CheckResult {
  pkg: PkgInfo;
  matches: number;
  allowedDisconnected: boolean;
}

function parseArgs(argv: string[]) {
  return {
    fail: argv.includes("--fail"),
    json: argv.includes("--json"),
  };
}

// Packages that are allowed to be disconnected by design.
// Keep this list small and force an explicit architectural decision per entry.
const ALLOWED_DISCONNECTED = new Set<string>(["@alfred/summarize"]);

function readPkgInfo(pkgsDir: string): PkgInfo[] {
  const out: PkgInfo[] = [];
  for (const dirName of readdirSync(pkgsDir)) {
    const full = join(pkgsDir, dirName);
    if (!statSync(full).isDirectory()) {
      continue;
    }

    const pkgJson = join(full, "package.json");
    try {
      const raw = readFileSync(pkgJson, "utf8");
      const parsed = JSON.parse(raw) as { name?: unknown };
      const name = typeof parsed.name === "string" ? parsed.name : null;
      if (!name || !name.startsWith("@alfred/")) {
        continue;
      }
      const short = name.slice("@alfred/".length);
      out.push({ dirName, name, short });
    } catch {}
  }
  return out;
}

async function runRgCount(args: {
  repoRoot: string;
  needle: string;
  ignoreDir: string;
}): Promise<number> {
  const proc = Bun.spawn(
    [
      "rg",
      "-n",
      "--count-matches",
      "--glob",
      "!docs/**",
      "--glob",
      "!**/bun.lock",
      "--glob",
      "!scripts/verify-integration-health.ts",
      "--glob",
      `!packages/${args.ignoreDir}/**`,
      args.needle,
      "apps",
      "packages",
      "scripts",
      "tests",
    ],
    {
      cwd: args.repoRoot,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        PATH: process.env.PATH ?? "",
      },
    }
  );

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  // rg exit codes: 0 matches, 1 no matches, 2 error
  if (exitCode === 2) {
    throw new Error(
      `rg_failed needle=${args.needle}\n${stderr.trim() || stdout.trim()}`
    );
  }

  const trimmed = stdout.trim();
  if (!trimmed) {
    return 0;
  }

  // Output format is "path:count" per file; sum counts.
  let sum = 0;
  for (const line of trimmed.split("\n")) {
    const idx = line.lastIndexOf(":");
    if (idx === -1) {
      continue;
    }
    const n = Number.parseInt(line.slice(idx + 1), 10);
    if (!Number.isNaN(n)) {
      sum += n;
    }
  }
  return sum;
}

function formatTable(results: CheckResult[]): string {
  const rows = [...results]
    .sort((a, b) => a.pkg.name.localeCompare(b.pkg.name))
    .map((r) => {
      const status =
        r.matches > 0
          ? "wired"
          : r.allowedDisconnected
            ? "standalone"
            : "disconnected";
      return `${status.padEnd(12)}  ${String(r.matches).padStart(6)}  ${r.pkg.name}`;
    });

  return [
    "status       matches  package",
    "-----------  -------  ----------------",
    ...rows,
  ].join("\n");
}

async function main(): Promise<void> {
  const { fail, json } = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const pkgsDir = join(repoRoot, "packages");

  const pkgs = readPkgInfo(pkgsDir);
  const results: CheckResult[] = [];

  for (const pkg of pkgs) {
    const needle = `@alfred/${pkg.short}`;
    const matches = await runRgCount({
      repoRoot,
      needle,
      ignoreDir: pkg.dirName,
    });
    results.push({
      matches,
      pkg,
      allowedDisconnected: matches === 0 && ALLOWED_DISCONNECTED.has(pkg.name),
    });
  }

  if (json) {
    process.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatTable(results)}\n`);
  }

  const disconnected = results.filter(
    (r) => r.matches === 0 && !r.allowedDisconnected
  );
  if (fail && disconnected.length > 0) {
    throw new Error(
      `integration_health_failed disconnected=${disconnected.length}`
    );
  }
}

await main();
