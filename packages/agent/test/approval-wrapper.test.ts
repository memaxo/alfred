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

// Install shared mocks
installAuthTokenMock();
installLoggerMock();

// Use shared mocks for assertions
const { requireToolScopesAndPolicy } = authTokenMocks;
const loggerWarn = loggerMocks.warn;
const _loggerError = loggerMocks.error;

const metrics = await import("../src/metrics");
const recordPolicyCheckFailureSpy = vi.spyOn(
  metrics,
  "recordPolicyCheckFailure"
);

const { withPolicyApproval } =
  await import("../src/orchestrator/tool/approval");

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
        description: "Test tool",
        execute: vi.fn(),
        name: "test_tool",
      },
      () => ({
        action: "test.action",
        authz: "token",
        resource: { kind: "repo", id: "123" },
        scopes: ["test.scope"],
      })
    );

    const needsApproval = await wrapped.needsApproval({} as never);

    expect(needsApproval).toBe(true);
    expect(loggerWarn).toHaveBeenCalledTimes(1);
    expect(loggerWarn).toHaveBeenCalledWith("policy_check_failed_in_approval", {
      action: "test.action",
      error: "pdp_unavailable",
      resource: { kind: "repo", id: "123" },
      tool: "test_tool",
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
        authz: "token",
        resource: { kind: "task", id: "run" },
        scopes: ["task.read"],
      })
    );

    await wrapped.needsApproval({} as never);

    expect(loggerWarn).toHaveBeenCalledWith("policy_check_failed_in_approval", {
      action: "fallback.action",
      error: "policy_timeout",
      resource: { kind: "task", id: "run" },
      tool: "Fallback tool",
    });
    expect(recordPolicyCheckFailureSpy).toHaveBeenCalledTimes(1);
    expect(recordPolicyCheckFailureSpy.mock.calls[0]?.[0]).toBe(
      "Fallback tool"
    );
  });
});
