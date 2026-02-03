import { Database } from "bun:sqlite";
import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  searchFiles,
  searchKv,
  searchToolCalls,
} from "../src/services/agentfs-search";

describe("agentfs search", () => {
  const rootAbs = path.resolve(
    process.cwd(),
    ".agent",
    "test-workspaces",
    "agentfs-search"
  );
  const agentfsDir = path.join(rootAbs, ".agentfs");

  afterAll(async () => {
    await rm(rootAbs, { force: true, recursive: true });
  });

  beforeEach(async () => {
    await rm(rootAbs, { force: true, recursive: true });
    await mkdir(agentfsDir, { recursive: true });
  });

  function initRunDb(args: { runId: string }): string {
    const runDir = path.join(agentfsDir, args.runId);
    const dbPath = path.join(runDir, "agentfs.db");
    return dbPath;
  }

  async function writeRunDb(args: {
    runId: string;
    files: { path: string; content: string }[];
    kv: { key: string; value: unknown; updatedAtSec: number }[];
    calls: {
      id: number;
      name: string;
      parameters: unknown;
      result: unknown;
      startedAtSec: number;
    }[];
    projectId?: string;
  }): Promise<void> {
    const runDir = path.join(agentfsDir, args.runId);
    await mkdir(runDir, { recursive: true });
    if (args.projectId) {
      await writeFile(
        path.join(runDir, ".project"),
        `${args.projectId}\n`,
        "utf8"
      );
    }

    const dbPath = initRunDb({ runId: args.runId });
    const db = new Database(dbPath);
    try {
      db.exec(`
        CREATE TABLE fs_inode (ino INTEGER PRIMARY KEY, size INTEGER);
        CREATE TABLE fs_dentry (name TEXT, ino INTEGER);
        CREATE TABLE fs_data (ino INTEGER, chunk_index INTEGER, data BLOB);
        CREATE TABLE kv_store (key TEXT, value TEXT, updated_at INTEGER);
        CREATE TABLE tool_calls (
          id INTEGER PRIMARY KEY,
          name TEXT,
          parameters TEXT,
          result TEXT,
          started_at INTEGER
        );
      `);

      let ino = 1;
      for (const file of args.files) {
        const buf = Buffer.from(file.content, "utf8");
        db.prepare("INSERT INTO fs_inode (ino, size) VALUES (?, ?)").run(
          ino,
          buf.length
        );
        db.prepare("INSERT INTO fs_dentry (name, ino) VALUES (?, ?)").run(
          file.path,
          ino
        );
        db.prepare(
          "INSERT INTO fs_data (ino, chunk_index, data) VALUES (?, ?, ?)"
        ).run(ino, 0, buf);
        ino++;
      }

      for (const kv of args.kv) {
        db.prepare(
          "INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)"
        ).run(kv.key, JSON.stringify(kv.value), kv.updatedAtSec);
      }

      for (const call of args.calls) {
        db.prepare(
          "INSERT INTO tool_calls (id, name, parameters, result, started_at) VALUES (?, ?, ?, ?, ?)"
        ).run(
          call.id,
          call.name,
          JSON.stringify(call.parameters),
          JSON.stringify(call.result),
          call.startedAtSec
        );
      }
    } finally {
      db.close();
    }
  }

  it("supports runIds + sensitivity filters for file search", async () => {
    await writeRunDb({
      runId: "run-1",
      files: [
        { path: "notes.txt", content: "hello world\nline2" },
        { path: ".env", content: "SECRET=abc123" },
      ],
      kv: [],
      calls: [],
    });

    await writeRunDb({
      runId: "run-2",
      files: [{ path: "other.txt", content: "no match here" }],
      kv: [],
      calls: [],
    });

    const all = await searchFiles("hello", {
      rootAbs,
      runIds: ["run-1"],
      sensitivity: "all",
    });
    expect(all.length).toBe(1);
    expect(all[0]?.runId).toBe("run-1");
    expect(all[0]?.filePath).toBe("notes.txt");

    const secretNormal = await searchFiles("SECRET", {
      rootAbs,
      runIds: ["run-1"],
      sensitivity: "normal",
    });
    expect(secretNormal.length).toBe(0);

    const secretSensitive = await searchFiles("SECRET", {
      rootAbs,
      runIds: ["run-1"],
      sensitivity: "sensitive",
    });
    expect(secretSensitive.length).toBe(1);
    expect(secretSensitive[0]?.filePath).toBe(".env");
  });

  it("supports valuePattern for KV search", async () => {
    await writeRunDb({
      runId: "run-1",
      files: [],
      kv: [
        {
          key: "foo",
          value: { tag: "alpha", text: "baz" },
          updatedAtSec: 1000,
        },
        { key: "bar", value: { tag: "beta", text: "qux" }, updatedAtSec: 1001 },
      ],
      calls: [],
    });

    const results = await searchKv(
      "*",
      { rootAbs, runIds: ["run-1"] },
      "*baz*"
    );
    expect(results.map((r) => r.key)).toEqual(["foo"]);
  });

  it("supports paramsPattern for tool call search", async () => {
    await writeRunDb({
      runId: "run-1",
      files: [],
      kv: [],
      calls: [
        {
          id: 1,
          name: "read_file",
          parameters: { path: "README.md" },
          result: { ok: true },
          startedAtSec: 1000,
        },
        {
          id: 2,
          name: "read_file",
          parameters: { path: ".env" },
          result: { ok: true },
          startedAtSec: 1001,
        },
      ],
    });

    const results = await searchToolCalls(
      "read*",
      { rootAbs, runIds: ["run-1"] },
      "*README*"
    );
    expect(results.length).toBe(1);
    expect(results[0]?.toolCall.name).toBe("read_file");
    expect(results[0]?.toolCall.parameters).toEqual({ path: "README.md" });
  });
});
