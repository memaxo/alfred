#!/usr/bin/env bun
/**
 * Proxmox provisioning workflow for ALFRED production topology.
 *
 * This script targets ALFRED itself (not apps ALFRED generates).
 *
 * Behavior:
 * - Idempotent "create or reuse" for 3 LXCs: alfred, alfred-db, alfred-redis
 * - Starts containers if stopped/paused
 * - Optionally verifies ALFRED health endpoints (/healthz, /healthz/deps)
 *
 * Safety:
 * - No destructive operations (no destroy) are performed by default.
 *
 * Required environment:
 * - PROXMOX_HOST
 * - PROXMOX_TOKEN_ID
 * - PROXMOX_TOKEN_SECRET
 * - PROXMOX_NODE
 *
 * Provisioning environment (recommended):
 * - PROXMOX_OSTEMPLATE
 * - PROXMOX_STORAGE
 * - PROXMOX_BRIDGE
 * - PROXMOX_GATEWAY
 * - PROXMOX_CIDR
 * - PROXMOX_ALFRED_IP / PROXMOX_DB_IP / PROXMOX_REDIS_IP
 *
 * Run:
 * - bun run scripts/proxmox.ts
 * - bun run scripts/proxmox.ts --no-verify
 * - bun run scripts/proxmox.ts --verify
 */

import { type ProxmoxError, proxmox } from "../packages/agent/src/lib/proxmox";

type LxcName = "alfred" | "alfred-db" | "alfred-redis";

interface LxcSpec {
  name: LxcName;
  vmid: number;
  hostname: string;
  ostemplate: string;
  rootfs: string;
  cores: number;
  memory: number;
  net0?: string;
  password?: string;
}

interface CliArgs {
  verify: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let verify = true;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      printHelpAndExit(0);
    }
    if (arg === "--verify") {
      verify = true;
    }
    if (arg === "--no-verify") {
      verify = false;
    }
  }

  return { verify };
}

function printHelpAndExit(code: number): never {
  console.log(`
scripts/proxmox.ts

Idempotently provisions ALFRED infrastructure on Proxmox:
- ALFRED server LXC
- Postgres (pgvector) LXC
- Redis LXC

Usage:
  bun run scripts/proxmox.ts
  bun run scripts/proxmox.ts --no-verify
  bun run scripts/proxmox.ts --verify

Required env:
  PROXMOX_HOST
  PROXMOX_TOKEN_ID
  PROXMOX_TOKEN_SECRET
  PROXMOX_NODE

Recommended env:
  PROXMOX_OSTEMPLATE
  PROXMOX_STORAGE
  PROXMOX_BRIDGE
  PROXMOX_GATEWAY
  PROXMOX_CIDR
  PROXMOX_ALFRED_IP
  PROXMOX_DB_IP
  PROXMOX_REDIS_IP

Optional health verification env:
  PROXMOX_ALFRED_URL     (overrides IP/port)
  PROXMOX_ALFRED_PORT    (default: 3000)
`);
  process.exit(code);
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value.trim();
}

function getEnv(key: string): string | null {
  const value = process.env[key];
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getEnvInt(key: string, fallback: number): number {
  const raw = getEnv(key);
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildBase(host: string): string {
  if (host.startsWith("http://") || host.startsWith("https://")) {
    return `${host}:8006/api2/json`;
  }
  return `https://${host}:8006/api2/json`;
}

function isProxmoxError(error: unknown): error is ProxmoxError {
  return (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    typeof (error as { kind?: unknown }).kind === "string"
  );
}

function buildNet0(spec: {
  bridge: string;
  ip: string | null;
  cidr: number;
  gateway: string | null;
}): string | null {
  const bridge = spec.bridge.trim();
  if (bridge.length === 0) {
    return null;
  }

  if (spec.ip && spec.gateway) {
    return `name=eth0,bridge=${bridge},ip=${spec.ip}/${spec.cidr},gw=${spec.gateway}`;
  }

  return `name=eth0,bridge=${bridge},ip=dhcp`;
}

async function ensureLxc(
  client: proxmox,
  node: string,
  spec: LxcSpec
): Promise<{ status: "running" | "stopped" | "paused" }> {
  let status: "running" | "stopped" | "paused";

  try {
    const current = await client.lxcStatus(node, spec.vmid);
    ({ status } = current);
    console.log(
      `[proxmox] ${spec.name} exists: vmid=${spec.vmid} status=${status}`
    );
  } catch (error) {
    if (!isProxmoxError(error) || error.kind !== "notfound") {
      throw error;
    }

    console.log(`[proxmox] ${spec.name} missing; creating vmid=${spec.vmid}…`);
    const created = await client.lxcCreate(node, {
      vmid: spec.vmid,
      hostname: spec.hostname,
      ostemplate: spec.ostemplate,
      rootfs: spec.rootfs,
      cores: spec.cores,
      memory: spec.memory,
      net0: spec.net0,
      password: spec.password,
    });
    console.log(`[proxmox] ${spec.name} create task: ${created.upid}`);
    const task = await client.taskWait(node, created.upid, {
      timeoutMs: 10 * 60_000,
    });
    console.log(
      `[proxmox] ${spec.name} create task finished: ${task.exitstatus}`
    );

    const current = await client.lxcStatus(node, spec.vmid);
    ({ status } = current);
  }

  if (status !== "running") {
    console.log(`[proxmox] starting ${spec.name}…`);
    const started = await client.lxcStart(node, spec.vmid);
    console.log(`[proxmox] ${spec.name} start task: ${started.upid}`);
    const task = await client.taskWait(node, started.upid, {
      timeoutMs: 5 * 60_000,
    });
    console.log(
      `[proxmox] ${spec.name} start task finished: ${task.exitstatus}`
    );
    const current = await client.lxcStatus(node, spec.vmid);
    ({ status } = current);
  }

  return { status };
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Response> {
  return fetch(url, {
    headers: {
      "cache-control": "no-store",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function verifyHealth(baseUrl: string): Promise<void> {
  const endpoints = ["/healthz", "/healthz/deps"] as const;
  const attempts = getEnvInt("PROXMOX_VERIFY_ATTEMPTS", 15);
  const timeoutMs = getEnvInt("PROXMOX_VERIFY_TIMEOUT_MS", 2000);
  const delayMs = getEnvInt("PROXMOX_VERIFY_DELAY_MS", 1000);

  console.log(`[verify] checking health at ${baseUrl}`);

  for (const path of endpoints) {
    const url = `${baseUrl}${path}`;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const resp = await fetchWithTimeout(url, timeoutMs);
        const bodyText = await resp.text();
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status} ${bodyText}`);
        }

        try {
          const parsed = JSON.parse(bodyText) as {
            ok?: boolean;
            redis?: string;
          };
          if (parsed.ok !== true) {
            throw new Error(`unexpected_body ${bodyText}`);
          }
          if (path === "/healthz/deps") {
            console.log(
              `[verify] ${path}: ok (redis=${parsed.redis ?? "unknown"})`
            );
          } else {
            console.log(`[verify] ${path}: ok`);
          }
        } catch {
          console.log(`[verify] ${path}: ok (non-json body)`);
        }

        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        console.log(
          `[verify] ${path}: attempt ${attempt}/${attempts} failed (${msg})`
        );
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    if (lastError) {
      throw lastError;
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const host = requireEnv("PROXMOX_HOST");
  const tokenId = requireEnv("PROXMOX_TOKEN_ID");
  const tokenSecret = requireEnv("PROXMOX_TOKEN_SECRET");
  const node = requireEnv("PROXMOX_NODE");

  const base = buildBase(host);
  const client = new proxmox({ base, tokenId, tokenSecret });

  const ostemplate = getEnv("PROXMOX_OSTEMPLATE");
  if (!ostemplate) {
    throw new Error(
      "Missing PROXMOX_OSTEMPLATE (e.g. local:vztmpl/ubuntu-22.04-standard_*.tar.zst)"
    );
  }

  const storage = getEnv("PROXMOX_STORAGE") ?? "local-lvm";
  const bridge = getEnv("PROXMOX_BRIDGE") ?? "vmbr0";
  const gateway = getEnv("PROXMOX_GATEWAY");
  const cidr = getEnvInt("PROXMOX_CIDR", 24);

  const password = getEnv("PROXMOX_LXC_PASSWORD") ?? undefined;

  const alfredVmid = getEnvInt("PROXMOX_ALFRED_VMID", 120);
  const dbVmid = getEnvInt("PROXMOX_DB_VMID", 121);
  const redisVmid = getEnvInt("PROXMOX_REDIS_VMID", 122);

  const alfredIp = getEnv("PROXMOX_ALFRED_IP");
  const dbIp = getEnv("PROXMOX_DB_IP");
  const redisIp = getEnv("PROXMOX_REDIS_IP");

  const alfredNet0 =
    getEnv("PROXMOX_NET0_ALFRED") ??
    buildNet0({ bridge, ip: alfredIp, cidr, gateway }) ??
    undefined;
  const dbNet0 =
    getEnv("PROXMOX_NET0_DB") ??
    buildNet0({ bridge, ip: dbIp, cidr, gateway }) ??
    undefined;
  const redisNet0 =
    getEnv("PROXMOX_NET0_REDIS") ??
    buildNet0({ bridge, ip: redisIp, cidr, gateway }) ??
    undefined;

  const specs: LxcSpec[] = [
    {
      name: "alfred",
      vmid: alfredVmid,
      hostname: getEnv("PROXMOX_ALFRED_HOSTNAME") ?? "alfred",
      ostemplate,
      rootfs: getEnv("PROXMOX_ALFRED_ROOTFS") ?? `${storage}:32`,
      cores: getEnvInt("PROXMOX_ALFRED_CORES", 4),
      memory: getEnvInt("PROXMOX_ALFRED_MEMORY", 4096),
      net0: alfredNet0,
      password,
    },
    {
      name: "alfred-db",
      vmid: dbVmid,
      hostname: getEnv("PROXMOX_DB_HOSTNAME") ?? "alfred-db",
      ostemplate,
      rootfs: getEnv("PROXMOX_DB_ROOTFS") ?? `${storage}:64`,
      cores: getEnvInt("PROXMOX_DB_CORES", 4),
      memory: getEnvInt("PROXMOX_DB_MEMORY", 4096),
      net0: dbNet0,
      password,
    },
    {
      name: "alfred-redis",
      vmid: redisVmid,
      hostname: getEnv("PROXMOX_REDIS_HOSTNAME") ?? "alfred-redis",
      ostemplate,
      rootfs: getEnv("PROXMOX_REDIS_ROOTFS") ?? `${storage}:8`,
      cores: getEnvInt("PROXMOX_REDIS_CORES", 2),
      memory: getEnvInt("PROXMOX_REDIS_MEMORY", 1024),
      net0: redisNet0,
      password,
    },
  ];

  console.log(`[proxmox] base=${base} node=${node}`);
  for (const spec of specs) {
    await ensureLxc(client, node, spec);
  }

  console.log("\n[proxmox] Provisioning summary:");
  for (const spec of specs) {
    const net0 =
      spec.name === "alfred"
        ? alfredNet0
        : spec.name === "alfred-db"
          ? dbNet0
          : redisNet0;
    console.log(
      `- ${spec.name}: vmid=${spec.vmid} hostname=${spec.hostname} net0=${net0 ?? "none"}`
    );
  }

  if (!args.verify) {
    console.log("\n[verify] skipped (--no-verify)");
    return;
  }

  const explicitUrl = getEnv("PROXMOX_ALFRED_URL");
  const port = getEnvInt("PROXMOX_ALFRED_PORT", 3000);
  const inferredUrl = alfredIp ? `http://${alfredIp}:${port}` : null;
  const baseUrl = explicitUrl ?? inferredUrl;

  if (!baseUrl) {
    console.log(
      "\n[verify] skipped (set PROXMOX_ALFRED_URL or PROXMOX_ALFRED_IP to enable health checks)"
    );
    return;
  }

  try {
    await verifyHealth(baseUrl);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[verify] FAILED: ${msg}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  if (isProxmoxError(error)) {
    console.error(
      `[proxmox] FAILED (${error.kind}): ${error.message} (${error.endpoint})`
    );
  } else {
    console.error("[proxmox] FAILED:", error);
  }
  process.exit(1);
});
