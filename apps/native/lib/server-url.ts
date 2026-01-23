import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";

const STORAGE_KEY = "alfred.serverUrl";

export type ServerUrlSource = "override" | "env" | "missing";

export type ServerUrlState = {
  url: string | null;
  source: ServerUrlSource;
};

export type NormalizeResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

function isNativeTestModeEnabled(): boolean {
  if (process.env.EXPO_PUBLIC_TEST_MODE === "1") {
    return true;
  }
  if (Platform.OS !== "ios") {
    return false;
  }
  const settings = (NativeModules as unknown as { SettingsManager?: unknown })
    .SettingsManager as { settings?: Record<string, unknown> } | undefined;
  const raw = settings?.settings?.ALFRED_TEST_MODE;
  return raw === "1" || raw === "true";
}

export function isLocalServer(urlString: string | null): boolean {
  if (!urlString) {
    return false;
  }
  try {
    const url = new URL(urlString);
    return url.hostname === "127.0.0.1" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

function normalizeUrlString(url: URL): string {
  // Normalize to: "<origin>" (no path/query/hash, no trailing slash)
  return url.origin;
}

export function normalizeServerUrl(input: string): NormalizeResult {
  const raw = input.trim();
  if (raw.length === 0) {
    return { ok: false, error: "server_url_empty" };
  }

  const withScheme = (() => {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return raw;
    }
    // Default to https for remote connectivity.
    return `https://${raw}`;
  })();

  try {
    const url = new URL(withScheme);
    if (!(url.protocol === "http:" || url.protocol === "https:")) {
      return { ok: false, error: "server_url_protocol" };
    }
    if (!url.hostname) {
      return { ok: false, error: "server_url_hostname" };
    }
    return { ok: true, url: normalizeUrlString(url) };
  } catch {
    return { ok: false, error: "server_url_parse" };
  }
}

export async function loadServerUrlOverride(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  const value = await AsyncStorage.getItem(STORAGE_KEY);
  return value && value.length > 0 ? value : null;
}

export async function saveServerUrlOverride(url: string | null): Promise<void> {
  if (Platform.OS === "web") {
    try {
      if (url) {
        localStorage.setItem(STORAGE_KEY, url);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
    return;
  }

  if (url) {
    await AsyncStorage.setItem(STORAGE_KEY, url);
    return;
  }
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function resolveServerUrl(): Promise<ServerUrlState> {
  // In native UI tests, prefer the launch-arg server URL even if a previous run
  // persisted an AsyncStorage override. This prevents flakiness across runs.
  if (Platform.OS === "ios" && isNativeTestModeEnabled()) {
    const settings = (NativeModules as unknown as { SettingsManager?: unknown })
      .SettingsManager as { settings?: Record<string, unknown> } | undefined;
    const raw = settings?.settings?.ALFRED_SERVER_URL;
    if (typeof raw === "string" && raw.trim().length > 0) {
      return { url: raw.trim(), source: "env" };
    }
  }

  const override = await loadServerUrlOverride();
  if (override) {
    return { url: override, source: "override" };
  }

  // UI-test override via iOS UserDefaults launch arguments.
  // XCUITest can pass: `-ALFRED_SERVER_URL http://127.0.0.1:3155`
  if (Platform.OS === "ios") {
    const settings = (NativeModules as unknown as { SettingsManager?: unknown })
      .SettingsManager as { settings?: Record<string, unknown> } | undefined;
    const raw = settings?.settings?.ALFRED_SERVER_URL;
    if (typeof raw === "string" && raw.trim().length > 0) {
      return { url: raw.trim(), source: "env" };
    }
  }

  const env = process.env.EXPO_PUBLIC_SERVER_URL;
  if (typeof env === "string" && env.length > 0) {
    return { url: env, source: "env" };
  }
  return { url: null, source: "missing" };
}

export type TailnetClassification =
  | { kind: "tailnet-hostname"; hostname: string; reason: string }
  | { kind: "tailnet-ipv4"; ip: string; reason: string }
  | { kind: "tailnet-ipv6"; ip: string; reason: string }
  | { kind: "non-tailnet"; host: string; reason: string }
  | { kind: "invalid"; reason: string };

function parseIpv4(
  host: string
): { ok: true; a: number; b: number } | { ok: false } {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return { ok: false };
  }
  const nums: number[] = [];
  for (const part of parts) {
    if (part.length === 0 || part.length > 3) {
      return { ok: false };
    }
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) {
      return { ok: false };
    }
    nums.push(n);
  }
  return { ok: true, a: nums[0], b: nums[1] };
}

function isTailscaleCgnatIpv4(host: string): boolean {
  // Tailscale IPv4 addresses are allocated from 100.64.0.0/10 by default.
  const parsed = parseIpv4(host);
  if (!parsed.ok) {
    return false;
  }
  return parsed.a === 100 && parsed.b >= 64 && parsed.b <= 127;
}

function isTailscaleUlaIpv6(host: string): boolean {
  // Tailscale's IPv6 ULA range uses the stable prefix fd7a:115c:a1e0::/48.
  const h = host.toLowerCase();
  return h === "fd7a:115c:a1e0" || h.startsWith("fd7a:115c:a1e0:");
}

export function classifyServerUrl(urlString: string): TailnetClassification {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { kind: "invalid", reason: "url_parse_failed" };
  }

  const hostRaw = url.hostname;
  if (!hostRaw) {
    return { kind: "invalid", reason: "hostname_missing" };
  }

  const host = (() => {
    // Bun's URL.hostname for IPv6 literals includes square brackets.
    if (hostRaw.startsWith("[") && hostRaw.endsWith("]")) {
      return hostRaw.slice(1, -1);
    }
    return hostRaw;
  })();

  const h = host.toLowerCase();
  if (h.endsWith(".ts.net")) {
    return {
      kind: "tailnet-hostname",
      hostname: h,
      reason: "hostname_ends_with_ts_net",
    };
  }

  if (isTailscaleCgnatIpv4(h)) {
    return { kind: "tailnet-ipv4", ip: h, reason: "ipv4_in_100_64_0_0_10" };
  }

  if (h.includes(":") && isTailscaleUlaIpv6(h)) {
    return { kind: "tailnet-ipv6", ip: h, reason: "ipv6_in_fd7a_115c_a1e0" };
  }

  return { kind: "non-tailnet", host: h, reason: "not_a_tailnet_host" };
}
