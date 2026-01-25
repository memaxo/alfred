import { z } from "zod";

import type {
  ExecutorEvalsConfig,
  ExecutorEvalsProfiles,
  ExecutorEvalsRetain,
  ExecutorEvalsTransport,
} from "./types.js";

const retainSchema = z.enum(["never", "on-fail", "always"]);
const profilesSchema = z.enum(["default", "server", "both"]);
const transportSchema = z.enum(["acp", "http"]);

interface Argv {
  confirmCost: boolean;
  preflightOnly: boolean;
  transport: ExecutorEvalsTransport;
  profiles: ExecutorEvalsProfiles;
  strict: boolean;
  skipBuild: boolean;
  image?: string;
  retain: ExecutorEvalsRetain;
  artifactsDir?: string;
  authz?: string;
  skipCodex: boolean;
  skipOpenCode: boolean;
  skipCrash: boolean;
}

export function defaultCliConfig(): ExecutorEvalsConfig {
  return {
    confirmCost: false,
    preflightOnly: false,
    transport: "acp",
    profiles: "both",
    strict: false,
    skipBuild: false,
    retain: "on-fail",
    skip: {},
  };
}

export function formatHelp(): string {
  return `@alfred/evals\n\nUsage:\n  bun run @alfred/evals/cli -- [options]\n\nOptions:\n  --confirm-cost                 Run provider calls (required to execute LLM calls)\n  --preflight                     Only run preflight + workspace (no provider calls)\n  --transport <acp|http>           OpenCode transport (default: acp)\n  --profiles <server|default|both> Which executor profiles to run (default: both)\n  --strict                         Enable strict exec profile (ORCH_EXEC_PROFILE_STRICT=1)\n  --skip-build                     Skip AgentFS image build check\n  --image <tag>                    AgentFS image tag (default: ORCH_DOCKER_IMAGE or alfred-agentfs:codex)\n  --retain <never|on-fail|always>  Container retention policy (default: on-fail)\n  --artifacts-dir <path>           Write artifacts to this directory\n  --authz <Bearer ...>             Authorization header value (advanced)\n  --skip-codex                     Skip Codex checks\n  --skip-opencode                  Skip OpenCode checks\n  --skip-crash                     Skip crash recovery checks\n  -h, --help                       Show help\n`;
}

function parseArgs(argv: string[]): Argv {
  const out: Argv = {
    confirmCost: false,
    preflightOnly: false,
    transport: "acp",
    profiles: "both",
    strict: false,
    skipBuild: false,
    retain: "on-fail",
    skipCodex: false,
    skipOpenCode: false,
    skipCrash: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) {
      continue;
    }
    switch (a) {
      case "-h":
      case "--help": {
        throw new Error("help_requested");
      }
      case "--confirm-cost": {
        out.confirmCost = true;
        break;
      }
      case "--preflight": {
        out.preflightOnly = true;
        break;
      }
      case "--strict": {
        out.strict = true;
        break;
      }
      case "--skip-build": {
        out.skipBuild = true;
        break;
      }
      case "--transport": {
        const v = argv[++i];
        out.transport = transportSchema.parse(v);
        break;
      }
      case "--profiles": {
        const v = argv[++i];
        out.profiles = profilesSchema.parse(v);
        break;
      }
      case "--retain": {
        const v = argv[++i];
        out.retain = retainSchema.parse(v);
        break;
      }
      case "--image": {
        out.image = argv[++i];
        break;
      }
      case "--artifacts-dir": {
        out.artifactsDir = argv[++i];
        break;
      }
      case "--authz": {
        out.authz = argv[++i];
        break;
      }
      case "--skip-codex": {
        out.skipCodex = true;
        break;
      }
      case "--skip-opencode": {
        out.skipOpenCode = true;
        break;
      }
      case "--skip-crash": {
        out.skipCrash = true;
        break;
      }
      default: {
        throw new Error(`unknown_arg:${a}`);
      }
    }
  }

  return out;
}

export function parseExecutorEvalsArgv(argv: string[]): ExecutorEvalsConfig {
  const args = parseArgs(argv);

  const cfg: ExecutorEvalsConfig = {
    confirmCost: args.confirmCost,
    preflightOnly: args.preflightOnly,
    transport: args.transport,
    profiles: args.profiles,
    strict: args.strict,
    skipBuild: args.skipBuild,
    image: args.image,
    retain: args.retain,
    artifactsDir: args.artifactsDir,
    authz: args.authz,
    skip: {
      codex: args.skipCodex,
      opencode: args.skipOpenCode,
      crashRecovery: args.skipCrash,
    },
  };

  return cfg;
}
