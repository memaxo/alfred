import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";

setupTestEnv();
mockPolicyAudit();

const toolCodexExecuteMock = vi.fn();

mock.module("@alfred/agent/orchestrator/tool/codex/index", () => ({
  toolCodex: {
    execute: toolCodexExecuteMock,
  },
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;
let issueAccessTokenImpl:
  | typeof import("@alfred/auth/token").issueAccessToken
  | null = null;

async function ensureSigningKeys() {
  if (process.env.AGENT_ED25519_PRIVATE && process.env.AGENT_ED25519_PUBLIC_PEM) {
    return;
  }
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", {
    extractable: true,
  });
  process.env.AGENT_ED25519_PRIVATE = await exportPKCS8(privateKey);
  process.env.AGENT_ED25519_PUBLIC_PEM = await exportSPKI(publicKey);
}

async function issueAuthToken(options?: {
  scopes?: string[];
  elevated?: boolean;
  ttlSec?: number;
  mfa?: "passkey" | "none";
  sub?: string;
}) {
  if (!issueAccessTokenImpl) {
    issueAccessTokenImpl = (
      await import("@alfred/auth/token")
    ).issueAccessToken;
  }

  return issueAccessTokenImpl(
    options?.sub ?? "codex-intent-user",
    options?.scopes ?? ["droid.exec"],
    "alfred:tools",
    {
      elevated: options?.elevated,
      ttlSec: options?.ttlSec,
      mfa: options?.mfa ?? (options?.elevated ? "passkey" : "none"),
    }
  );
}

beforeAll(async () => {
  await ensureSigningKeys();
  caller = await createTestCaller();
});

beforeEach(() => {
  toolCodexExecuteMock.mockReset();
  toolCodexExecuteMock.mockResolvedValue({
    result: "codex-output",
    artifacts: [],
  });
});

afterEach(() => {
  resetAllMocks();
});

describe("codex-intent router", () => {
  it("defaults to read autonomy when auto is omitted", async () => {
    const response = await caller.codexIntent.run({ intent: "Fix issue" });

    expect(response.intent).toBe("Fix issue");
    expect(response.result).toBe("codex-output");
    expect(toolCodexExecuteMock).toHaveBeenCalledTimes(1);
    expect(toolCodexExecuteMock.mock.calls[0]?.[0]?.input.auto).toBe("read");
    expect(toolCodexExecuteMock.mock.calls[0]?.[0]?.input.userId).toBe(
      "test-user"
    );
  });

  it("rejects high autonomy when authz is missing", async () => {
    await expect(
      caller.codexIntent.run({ intent: "Fix issue", auto: "high" })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "authz_required_for_elevated_autonomy",
    });

    expect(toolCodexExecuteMock).not.toHaveBeenCalled();
  });

  it("allows high autonomy with elevated authz", async () => {
    const authzToken = await issueAuthToken({ elevated: true, mfa: "passkey" });
    const authz = `Bearer ${authzToken}`;
    const response = await caller.codexIntent.run({
      intent: "Fix issue",
      auto: "high",
      authz,
    });

    expect(response.result).toBe("codex-output");
    expect(toolCodexExecuteMock).toHaveBeenCalledTimes(1);
    expect(toolCodexExecuteMock.mock.calls[0]?.[0]?.input.authz).toBe(authz);
    expect(toolCodexExecuteMock.mock.calls[0]?.[0]?.input.userId).toBe(
      "test-user"
    );
  });

  it("rejects non-elevated authz for high autonomy", async () => {
    const authz = `Bearer ${await issueAuthToken({ elevated: false, mfa: "none" })}`;

    await expect(
      caller.codexIntent.run({ intent: "Fix issue", auto: "high", authz })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "biometric_required",
    });

    expect(toolCodexExecuteMock).not.toHaveBeenCalled();
  });

  it("passes the authenticated userId to the Codex tool", async () => {
    await caller.codexIntent.run({ intent: "Investigate outage" });

    expect(toolCodexExecuteMock).toHaveBeenCalledTimes(1);
    expect(toolCodexExecuteMock.mock.calls[0]?.[0]?.input.userId).toBe(
      "test-user"
    );
  });

  it("rejects tokens missing required scopes", async () => {
    const authz = `Bearer ${await issueAuthToken({
      scopes: ["assistant.read"],
      elevated: true,
      mfa: "passkey",
    })}`;

    await expect(
      caller.codexIntent.run({ intent: "Fix issue", auto: "high", authz })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "token_missing_scope",
    });

    expect(toolCodexExecuteMock).not.toHaveBeenCalled();
  });

  it("rejects expired authz tokens", async () => {
    const base = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => base);
    try {
      const token = await issueAuthToken({
        elevated: true,
        mfa: "passkey",
        ttlSec: 1,
      });

      nowSpy.mockImplementation(() => base + 3_000);

      await expect(
        caller.codexIntent.run({
          intent: "Fix issue",
          auto: "high",
          authz: `Bearer ${token}`,
        })
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "token_expired",
      });
    } finally {
      nowSpy.mockRestore();
    }

    expect(toolCodexExecuteMock).not.toHaveBeenCalled();
  });
});
