#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

import type { FineTuneJobOptions, FineTuneLogEvent } from "./run-types";

import { parseFineTuneConfig } from "./config";
import { runFineTuneJob } from "./job";

interface CliArgs {
  configPath: string | null;
  workspaceRoot?: string;
  runsRoot?: string;
  pythonBin?: string;
  env: Record<string, string>;
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.configPath) {
    process.exit(1);
  }

  const configInput = await loadConfigFile(args.configPath);
  const config = parseFineTuneConfig(configInput);

  const workspaceRoot = args.workspaceRoot
    ? path.resolve(args.workspaceRoot)
    : process.cwd();
  const runsRoot = args.runsRoot ? path.resolve(args.runsRoot) : undefined;

  const options: FineTuneJobOptions = {
    workspaceRoot,
    runsRoot,
    pythonBin: args.pythonBin,
    env: args.env,
    onLog: streamLog,
  };

  try {
    const result = await runFineTuneJob(config, options);
    // Summary available for future use
    const _summary = {
      runId: result.runId,
      status: result.status,
      outputDir: result.artifacts.outputDir,
      adaptersPath: result.artifacts.adaptersPath,
      fusedModelDir: result.artifacts.fusedModelDir,
      startedAt: result.startedAt.toISOString(),
      completedAt: result.completedAt.toISOString(),
    };
    void _summary; // Suppress unused variable warning
  } catch {
    process.exit(1);
  }
};

const parseArgs = (argv: string[]): CliArgs => {
  const args: CliArgs = {
    configPath: null,
    env: {},
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--config":
      case "-c": {
        args.configPath = argv[++i] ?? null;
        break;
      }
      case "--workspace-root": {
        args.workspaceRoot = argv[++i];
        break;
      }
      case "--runs-root": {
        args.runsRoot = argv[++i];
        break;
      }
      case "--python": {
        args.pythonBin = argv[++i];
        break;
      }
      case "--env": {
        const pair = argv[++i];
        if (pair) {
          const [key, ...rest] = pair.split("=");
          if (key && rest.length > 0) {
            args.env[key] = rest.join("=");
          }
        }
        break;
      }
      default:
    }
  }
  return args;
};

const loadConfigFile = async (configPath: string) => {
  const absolutePath = path.resolve(configPath);
  const contents = await readFile(absolutePath, "utf8");
  const ext = path.extname(absolutePath).toLowerCase();
  if (ext === ".yaml" || ext === ".yml") {
    return YAML.parse(contents);
  }
  return JSON.parse(contents);
};

const streamLog = (event: FineTuneLogEvent) => {
  const target = event.source === "stderr" ? process.stderr : process.stdout;
  target.write(`${event.raw}\n`);
};

if (import.meta.main) {
  await main();
}
