import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";

let connectMock = mock(async () => {});

mock.module("pg", () => {
  class MockClient {
    connect(...args: unknown[]) {
      return connectMock(...args);
    }
  }

  class MockPool {}

  const moduleExports = {
    Client: MockClient,
    Pool: MockPool,
  };

  return {
    ...moduleExports,
    default: moduleExports,
  };
});

// Use shared test utilities - import BEFORE any other imports
import { installLoggerMock, loggerMocks } from "@alfred/test-kit/logger";

// Install shared mocks
installLoggerMock();

// Use shared mocks for assertions
const debugMock = loggerMocks.debug;
const infoMock = loggerMocks.info;
const warnMock = loggerMocks.warn;
const errorMock = loggerMocks.error;

const ORIGINAL_DB_URL = process.env.DATABASE_URL;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_DB_RETRY_ENABLED = process.env.DB_RETRY_ENABLED;

let createPgClient: typeof import("../src/client").createPgClient;
let connectWithRetry: typeof import("../src/client").connectWithRetry;

function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeAll(async () => {
  ({ createPgClient, connectWithRetry } = await import("../src/client"));
});

beforeEach(() => {
  connectMock = mock(async () => {});
  warnMock.mockReset();
  errorMock.mockReset();
  debugMock.mockReset();
  infoMock.mockReset();
  process.env.DATABASE_URL = "postgres://local/test";
  process.env.DB_RETRY_ENABLED = undefined;
  process.env.NODE_ENV = "development";
});

afterEach(() => {
  process.env.DATABASE_URL = ORIGINAL_DB_URL;
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  process.env.DB_RETRY_ENABLED = ORIGINAL_DB_RETRY_ENABLED;
});

afterAll(() => {
  process.env.DATABASE_URL = ORIGINAL_DB_URL;
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  process.env.DB_RETRY_ENABLED = ORIGINAL_DB_RETRY_ENABLED;
  mock.restore();
});

describe("connectWithRetry", () => {
  it("retries transient failures with exponential backoff", async () => {
    const delays: number[] = [];
    let attempts = 0;
    const transientClient = {
      connect() {
        if (attempts < 2) {
          attempts += 1;
          return Promise.reject(new Error("connection refused"));
        }
        attempts += 1;
        return Promise.resolve();
      },
    };

    await connectWithRetry(transientClient as any, {
      maxRetries: 5,
      initialDelay: 100,
      maxDelay: 5000,
      sleep: (ms) => {
        delays.push(ms);
        return Promise.resolve();
      },
    });

    expect(delays).toEqual([100, 200]);
    expect(attempts).toBe(3);
    expect(warnMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry authentication failures", async () => {
    const authClient = {
      connect() {
        return Promise.reject(
          new Error("password authentication failed for user")
        );
      },
    };

    await expect(
      connectWithRetry(authClient as any, {
        maxRetries: 5,
        sleep: () => Promise.resolve(),
      })
    ).rejects.toThrow(/authentication/);
    expect(warnMock).not.toHaveBeenCalled();
  });

  it("stops after the configured max retries", async () => {
    let attempts = 0;
    const failingClient = {
      connect() {
        attempts += 1;
        return Promise.reject(new Error("connection refused"));
      },
    };

    await expect(
      connectWithRetry(failingClient as any, {
        maxRetries: 3,
        initialDelay: 50,
        sleep: () => Promise.resolve(),
      })
    ).rejects.toThrow(/connection refused/);
    expect(attempts).toBe(3);
  });
});

describe("createPgClient", () => {
  it("connects once without retries in development by default", () => {
    createPgClient();
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(warnMock).not.toHaveBeenCalled();
  });

  it("retries in production by default", async () => {
    process.env.NODE_ENV = "production";
    const delays: number[] = [];
    let callCount = 0;
    connectMock = mock(() => {
      if (callCount < 2) {
        callCount += 1;
        return Promise.reject(new Error("connection failed"));
      }
      callCount += 1;
      return Promise.resolve();
    });

    createPgClient(undefined, {
      retry: {
        sleep: (ms) => {
          delays.push(ms);
          return Promise.resolve();
        },
      },
    });

    await nextTick();

    expect(connectMock).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([100, 200]);
    expect(warnMock).toHaveBeenCalledTimes(2);
    expect(errorMock).not.toHaveBeenCalled();
  });

  it("honors DB_RETRY_ENABLED=false override", () => {
    process.env.NODE_ENV = "production";
    process.env.DB_RETRY_ENABLED = "false";

    createPgClient();

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(warnMock).not.toHaveBeenCalled();
  });

  it("allows enabling retries via config override", async () => {
    let callCount = 0;
    connectMock = mock(() => {
      if (callCount < 1) {
        callCount += 1;
        return Promise.reject(new Error("connection failed"));
      }
      callCount += 1;
      return Promise.resolve();
    });

    createPgClient(undefined, {
      retry: {
        enabled: true,
        sleep: async () => {},
        maxRetries: 3,
      },
    });

    await nextTick();

    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(warnMock).toHaveBeenCalledTimes(1);
  });

  it("logs an error after max retry attempts", async () => {
    connectMock = mock(() => Promise.reject(new Error("startup failure")));

    createPgClient(undefined, {
      retry: {
        enabled: true,
        maxRetries: 3,
        sleep: () => Promise.resolve(),
      },
    });

    await nextTick();

    expect(connectMock).toHaveBeenCalledTimes(3);
    expect(errorMock).toHaveBeenCalledWith(
      "db_client_connection_failed_after_retries",
      expect.objectContaining({ maxRetries: 3 })
    );
  });

  it("enables retries when DB_RETRY_ENABLED=true", async () => {
    process.env.DB_RETRY_ENABLED = "true";
    let callCount = 0;
    const delays: number[] = [];
    connectMock = mock(() => {
      if (callCount < 1) {
        callCount += 1;
        return Promise.reject(new Error("connection failed"));
      }
      callCount += 1;
      return Promise.resolve();
    });

    createPgClient(undefined, {
      retry: {
        sleep: (ms) => {
          delays.push(ms);
          return Promise.resolve();
        },
      },
    });

    await nextTick();

    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([100]);
    expect(warnMock).toHaveBeenCalledTimes(1);
  });
});
