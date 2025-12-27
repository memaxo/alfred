import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

// Use shared test utilities - import BEFORE any other imports
import {
  authTokenMocks,
  installAuthTokenMock,
  resetAuthTokenMocks,
} from "@alfred/test-kit/auth/token";
import {
  installLoggerMock,
  loggerMocks,
  resetLoggerMocks,
} from "@alfred/test-kit/logger";

// Install shared mocks
installAuthTokenMock();
installLoggerMock();

// Use shared mocks for assertions
const requireToolScopesAndPolicy = authTokenMocks.requireToolScopesAndPolicy;
const loggerWarn = loggerMocks.warn;
const _loggerError = loggerMocks.error;

const metrics = await import("../src/metrics");
const recordPolicyCheckFailureSpy = vi.spyOn(
  metrics,
  "recordPolicyCheckFailure"
);

const { withPolicyApproval } = await import(
  "../src/orchestrator/tool/approval"
);

describe("withPolicyApproval", () => {
  beforeEach(() => {
    resetAuthTokenMocks();
    resetLoggerMocks();
    recordPolicyCheckFailureSpy.mockClear();
  });

  afterEach(() => {
    process.env.NEEDS_APPROVAL = undefined;
  });

  afterAll(() => {
    mock.restore();
  });

  it("logs and records metric when policy enforcement throws", async () => {
    requireToolScopesAndPolicy.mockImplementation(() => {
      throw new Error("pdp_unavailable");
    });

    const wrapped = withPolicyApproval(
      {
        name: "test_tool",
        description: "Test tool",
        execute: vi.fn(),
      },
      () => ({
        action: "test.action",
        resource: { kind: "repo", id: "123" },
        scopes: ["test.scope"],
        authz: "token",
      })
    );

    const needsApproval = await wrapped.needsApproval({} as never);

    expect(needsApproval).toBe(true);
    expect(loggerWarn).toHaveBeenCalledTimes(1);
    expect(loggerWarn).toHaveBeenCalledWith("policy_check_failed_in_approval", {
      tool: "test_tool",
      action: "test.action",
      resource: { kind: "repo", id: "123" },
      error: "pdp_unavailable",
    });
    expect(recordPolicyCheckFailureSpy).toHaveBeenCalledWith("test_tool");
  });

  it("defaults to description when tool name missing", async () => {
    requireToolScopesAndPolicy.mockImplementation(() => {
      throw new Error("policy_timeout");
    });

    const wrapped = withPolicyApproval(
      {
        description: "Fallback tool",
        execute: vi.fn(),
      } as any,
      () => ({
        action: "fallback.action",
        resource: { kind: "task", id: "run" },
        scopes: ["task.read"],
        authz: "token",
      })
    );

    await wrapped.needsApproval({} as never);

    expect(loggerWarn).toHaveBeenCalledWith("policy_check_failed_in_approval", {
      tool: "Fallback tool",
      action: "fallback.action",
      resource: { kind: "task", id: "run" },
      error: "policy_timeout",
    });
    expect(recordPolicyCheckFailureSpy).toHaveBeenCalledWith("Fallback tool");
  });
});
