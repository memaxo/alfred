// Use shared test utilities - import BEFORE any other imports
import {
  authTokenMocks,
  installAuthTokenMock,
  resetAuthTokenMocks,
} from "@alfred/test-kit/auth/token";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { __internals as dockerInternals } from "../src/orchestrator/tool/docker";
import { toolDroid } from "../src/orchestrator/tool/droid";
import { __internals as gitInternals } from "../src/orchestrator/tool/git";
import * as filesystem from "../src/security/filesystem";
import { openDirectorySecure } from "../src/security/filesystem";

// Install shared mocks
installAuthTokenMock();

// Use shared mock for assertions
const mockRequireToolScopesAndPolicy =
  authTokenMocks.requireToolScopesAndPolicy;

/**
 * Security Test Cleanup
 *
 * These tests create fixtures inside process.cwd()/tmp because
 * openDirectorySecure only allows directories under process.cwd().
 * We clean up after all tests to avoid polluting the repository.
 */
const REPO_TMP = path.join(process.cwd(), "tmp");

afterAll(() => {
  if (!existsSync(REPO_TMP)) {
    return;
  }

  // Clean up only security test fixtures (prefixed with git-secure-, droid-secure-, docker-secure-)
  try {
    const entries = readdirSync(REPO_TMP);
    for (const entry of entries) {
      if (
        entry.startsWith("git-secure-") ||
        entry.startsWith("droid-secure-") ||
        entry.startsWith("docker-secure-")
      ) {
        rmSync(path.join(REPO_TMP, entry), { recursive: true, force: true });
      }
    }
  } catch {
    // Ignore cleanup errors
  }
});

beforeEach(() => {
  resetAuthTokenMocks();
  mockRequireToolScopesAndPolicy.mockResolvedValue({
    decision: { allow: true },
    claims: { elevated: true, mfa: "passkey" },
  });
  process.env.ORCH_SECURE_SPAWN_WRAPPER = process.execPath;
  process.env.ORCH_SKIP_SECURE_SPAWN = "0";
});

afterEach(() => {
  process.env.DROID_BIN = undefined;
  process.env.DOCKER_BIN = undefined;
  process.env.ORCH_SECURE_SPAWN_WRAPPER = undefined;
  process.env.ORCH_SKIP_SECURE_SPAWN = undefined;
});

/**
 * Creates a workspace fixture for security tests.
 *
 * IMPORTANT: These tests specifically test the security boundary enforcement.
 * The workspace MUST be inside process.cwd() for openDirectorySecure to accept it.
 * The "outside" directory is in os.tmpdir() to simulate an escape target.
 *
 * The fixture is always cleaned up in the test's finally block via cleanupPaths().
 */
function createWorkspaceFixture(prefix: string) {
  // Security tests require workspace inside cwd - openDirectorySecure checks this
  const repoTmp = path.join(process.cwd(), "tmp");
  mkdirSync(repoTmp, { recursive: true });
  const base = mkdtempSync(path.join(repoTmp, prefix));
  const workspace = path.join(base, "workspace");
  mkdirSync(workspace, { recursive: true });
  // "outside" must be outside cwd to test escape prevention
  const outside = mkdtempSync(path.join(os.tmpdir(), `${prefix}outside-`));
  return { base, workspace, outside };
}

function replaceWithSymlink(workspace: string, outside: string) {
  const backup = `${workspace}-real`;
  renameSync(workspace, backup);
  symlinkSync(outside, workspace);
  return backup;
}

function cleanupPaths(...paths: string[]) {
  for (const target of paths) {
    rmSync(target, { recursive: true, force: true });
  }
}

describe("secure working directory handles", () => {
  it("keeps git commands pinned after symlink swap", async () => {
    const { base, workspace, outside } = createWorkspaceFixture("git-secure-");
    const handle = openDirectorySecure(workspace);
    const backup = replaceWithSymlink(workspace, outside);

    const spawnSpy = vi.spyOn(Bun, "spawn").mockImplementation(() => ({
      stdout: null,
      stderr: null,
      stdin: null,
      exited: Promise.resolve(0),
      kill: () => {},
    }));

    try {
      await gitInternals.runGit({
        cwdHandle: handle,
        args: ["status"],
        writer: undefined as any,
        timeoutSec: 5,
      });

      const spawnArgs = spawnSpy.mock.calls[0]?.[0];
      const spawnOptions = spawnSpy.mock.calls[0]?.[1];
      expect(spawnArgs?.[0]).toBe(process.execPath);
      expect(spawnOptions?.cwd).toBeUndefined();
      expect(spawnOptions?.env?.ALFRED_CWD_FD).toBe(String(handle.fd));
    } finally {
      spawnSpy.mockRestore();
      handle.close();
      cleanupPaths(workspace, backup, outside, base);
    }
  });

  it("prevents droid commands from escaping via swapped symlink", async () => {
    const { base, workspace, outside } =
      createWorkspaceFixture("droid-secure-");
    process.env.DROID_BIN = process.execPath;

    const originalOpen = filesystem.openDirectorySecure;
    let swapped = false;
    const spy = vi
      .spyOn(filesystem, "openDirectorySecure")
      .mockImplementation((candidate, options) => {
        const handle = originalOpen(candidate, options);
        if (!swapped && path.resolve(candidate) === path.resolve(workspace)) {
          replaceWithSymlink(workspace, outside);
          swapped = true;
        }
        return handle;
      });

    const spawnSpy = vi.spyOn(Bun, "spawn").mockImplementation(() => ({
      stdout: null,
      stderr: null,
      stdin: null,
      exited: Promise.resolve(0),
      kill: () => {},
    }));

    try {
      await toolDroid.execute({
        input: {
          action: "exec",
          prompt: "pwd",
          out: "text",
          auto: "read",
          cw: workspace,
          timeoutSec: 120,
          authz: "token",
        },
      });

      const spawnArgs = spawnSpy.mock.calls[0]?.[0];
      const spawnOptions = spawnSpy.mock.calls[0]?.[1];
      expect(spawnArgs?.[0]).toBe(process.execPath);
      expect(spawnOptions?.cwd).toBeUndefined();
      expect(spawnOptions?.env?.ALFRED_CWD_FD).toMatch(/^[0-9]+$/);
    } finally {
      spy.mockRestore();
      spawnSpy.mockRestore();
      cleanupPaths(workspace, `${workspace}-real`, outside, base);
    }
  });

  it("keeps docker commands pinned to original directory", async () => {
    const { base, workspace, outside } =
      createWorkspaceFixture("docker-secure-");
    process.env.DOCKER_BIN = process.execPath;

    const handle = openDirectorySecure(workspace);
    const backup = replaceWithSymlink(workspace, outside);

    const spawnSpy = vi.spyOn(Bun, "spawn").mockImplementation(() => ({
      stdout: null,
      stderr: null,
      stdin: null,
      exited: Promise.resolve(0),
      kill: () => {},
    }));

    try {
      await dockerInternals.runDocker({
        args: ["ps"],
        cwdHandle: handle,
        writer: undefined as any,
        timeoutSec: 5,
      });

      const spawnArgs = spawnSpy.mock.calls[0]?.[0];
      const spawnOptions = spawnSpy.mock.calls[0]?.[1];
      expect(spawnArgs?.[0]).toBe(process.execPath);
      expect(spawnOptions?.cwd).toBeUndefined();
      expect(spawnOptions?.env?.ALFRED_CWD_FD).toBe(String(handle.fd));
    } finally {
      spawnSpy.mockRestore();
      handle.close();
      cleanupPaths(workspace, backup, outside, base);
    }
  });
});
