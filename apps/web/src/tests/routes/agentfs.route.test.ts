import { afterAll, describe, expect, it, mock, vi } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

mock.module("@alfred/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: { id: "user-1", roles: [], scopes: [] },
      }),
    },
  },
}));

mock.module("@alfred/policy", () => ({
  evaluate: vi.fn().mockResolvedValue({ allow: true }),
}));

mock.module("@alfred/api/agentfsaccess", () => ({
  checkAgentfsAccess: vi.fn().mockResolvedValue({
    allow: true,
    projectId: "11111111-1111-4111-8111-111111111111",
  }),
}));

mock.module("../../../server/agentfs", () => ({
  isUuid: (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    ),
  openAgentfsDb: vi.fn(async () => ({
    baseDir: null,
    fsdb: { close: async () => {} },
  })),
}));

import { Route as ExportRoute } from "@/routes/api/agentfs/export";
import { Route as RestoreRoute } from "@/routes/api/agentfs/restore";

describe("agentfs export/restore routes", () => {
  const root = path.join(process.cwd(), ".agentfs");

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
    await rm(path.join(process.cwd(), "tmp", "agentfs-restore"), {
      recursive: true,
      force: true,
    });
  });

  it("exports to CAS (store=1), downloads by sha, and restores by sha", async () => {
    await rm(root, { recursive: true, force: true });

    const runId = "22222222-2222-4222-8222-222222222222";
    const runDir = path.join(root, runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, "agentfs.db"), "db", "utf8");

    const dbPath = `.agentfs/${runId}/agentfs.db`;
    const projectId = "11111111-1111-4111-8111-111111111111";

    const exportReq = new Request(
      `http://localhost/api/agentfs/export?runId=${runId}&dbPath=${encodeURIComponent(
        dbPath
      )}&store=1&projectId=${projectId}`,
      { method: "GET" }
    );

    const exportRes = await ExportRoute.options.server?.handlers?.GET?.(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { request: exportReq } as any
    );

    expect(exportRes?.status).toBe(200);
    const sha = exportRes?.headers.get("x-agentfs-cas-sha");
    expect(sha).toBeTruthy();
    expect(sha && /^[a-f0-9]{64}$/i.test(sha)).toBe(true);

    const exportBuf = await exportRes?.arrayBuffer();
    expect(exportBuf && exportBuf.byteLength > 0).toBe(true);

    const shaVal = sha as string;
    expect(existsSync(path.join(root, "cas", `${shaVal}.tar.gz`))).toBe(true);
    expect(existsSync(path.join(root, "cas", `${shaVal}.json`))).toBe(true);

    const shaReqMissingProject = new Request(
      `http://localhost/api/agentfs/export?sha=${shaVal}`,
      { method: "GET" }
    );
    const shaResMissingProject =
      await ExportRoute.options.server?.handlers?.GET?.(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { request: shaReqMissingProject } as any
      );
    expect(shaResMissingProject?.status).toBe(403);

    const shaReq = new Request(
      `http://localhost/api/agentfs/export?sha=${shaVal}&projectId=${projectId}`,
      { method: "GET" }
    );
    const shaRes = await ExportRoute.options.server?.handlers?.GET?.(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { request: shaReq } as any
    );
    expect(shaRes?.status).toBe(200);

    const restoreReq = new Request("http://localhost/api/agentfs/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: shaVal, projectId }),
    });
    const restoreRes = await RestoreRoute.options.server?.handlers?.POST?.(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { request: restoreReq } as any
    );
    expect(restoreRes?.status).toBe(200);

    const restoreJson = (await restoreRes?.json().catch(() => null)) as null | {
      runId?: string;
      dbPath?: string;
    };
    expect(typeof restoreJson?.runId).toBe("string");
    expect(typeof restoreJson?.dbPath).toBe("string");

    const restoredRunId = restoreJson?.runId ?? "";
    const projectFile = path.join(root, restoredRunId, ".project");
    expect(existsSync(projectFile)).toBe(true);
    const stored = (await readFile(projectFile, "utf8")).trim();
    expect(stored).toBe(projectId);
  });
});
