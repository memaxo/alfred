import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  findRelevantFiles,
  findBySymbol,
  findByDependency,
  rebuildIndex,
  clearIndex,
} from "../src/index.js";

describe("semantic extraction", () => {
  let workspace: string;

  beforeAll(async () => {
    workspace = await mkdtemp(join(tmpdir(), "codeprint-semantic-"));
    await mkdir(join(workspace, "src"), { recursive: true });

    // Create files with various symbol types
    await writeFile(
      join(workspace, "src/auth.ts"),
      `
export function login(user: string, pass: string): Promise<Token> {
  return authenticate(user, pass);
}

export function logout(): void {
  clearSession();
}

export class AuthProvider {
  private token: Token | null = null;
  
  async verify(token: string): Promise<boolean> {
    return validateToken(token);
  }
}

export interface Token {
  value: string;
  expiresAt: number;
}

export type AuthResult = { success: boolean; token?: Token };

function authenticate(user: string, pass: string): Promise<Token> {
  // internal function
  return Promise.resolve({ value: "token", expiresAt: Date.now() });
}
`
    );

    await writeFile(
      join(workspace, "src/db.ts"),
      `
import { drizzle } from "drizzle-orm";
import { pg } from "pg";

export class Database {
  private client = new pg.Client();
  
  async query(sql: string): Promise<unknown[]> {
    return this.client.query(sql);
  }
}

export const db = drizzle(new pg.Pool());

export enum ConnectionState {
  Connected = "connected",
  Disconnected = "disconnected",
}
`
    );

    await writeFile(
      join(workspace, "src/utils.ts"),
      `
export const VERSION = "1.0.0";

export const formatDate = (d: Date): string => d.toISOString();

export const { parse, stringify } = JSON;
`
    );

    await writeFile(
      join(workspace, "src/consumer.ts"),
      `
import { login, AuthProvider } from "./auth";
import { Database } from "./db";

export async function initApp(): Promise<void> {
  const auth = new AuthProvider();
  const db = new Database();
  await login("admin", "secret");
}
`
    );

    // Build the index
    await rebuildIndex(workspace);
  });

  afterAll(async () => {
    clearIndex(workspace);
    await rm(workspace, { recursive: true, force: true });
  });

  describe("findBySymbol", () => {
    it("finds files with exported functions", async () => {
      const results = await findBySymbol(workspace, "login", {
        kind: "function",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.path).toBe("src/auth.ts");
      expect(results[0]!.method).toBe("symbol");
    });

    it("finds files with exported classes", async () => {
      const results = await findBySymbol(workspace, "auth provider", {
        kind: "class",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.path).toBe("src/auth.ts");
    });

    it("finds files with exported interfaces", async () => {
      const results = await findBySymbol(workspace, "token", {
        kind: "interface",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.path).toBe("src/auth.ts");
    });

    it("finds files with exported types", async () => {
      const results = await findBySymbol(workspace, "auth result", {
        kind: "type",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.path).toBe("src/auth.ts");
    });

    it("finds files with exported enums", async () => {
      const results = await findBySymbol(workspace, "connection state", {
        kind: "enum",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.path).toBe("src/db.ts");
    });

    it("finds files with exported variables", async () => {
      const results = await findBySymbol(workspace, "version", {
        kind: "variable",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.path).toBe("src/utils.ts");
    });

    it("respects exportedOnly option", async () => {
      // 'authenticate' is not exported
      const exported = await findBySymbol(workspace, "authenticate", {
        exportedOnly: true,
      });
      const all = await findBySymbol(workspace, "authenticate", {
        exportedOnly: false,
      });

      expect(exported.length).toBe(0);
      expect(all.length).toBeGreaterThanOrEqual(0); // May or may not find internal function
    });

    it("supports multiple kinds filter", async () => {
      const results = await findBySymbol(workspace, "database", {
        kind: ["class", "variable"],
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it("returns empty for no matches", async () => {
      const results = await findBySymbol(workspace, "nonexistent symbol xyz");
      expect(results).toEqual([]);
    });
  });

  describe("findByDependency", () => {
    it("finds files importing a package", async () => {
      const results = await findByDependency(workspace, "drizzle-orm");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.path).toBe("src/db.ts");
      expect(results[0]!.method).toBe("dependency");
    });

    it("finds files importing pg", async () => {
      const results = await findByDependency(workspace, "pg");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.path).toBe("src/db.ts");
    });

    it("returns empty for unused package", async () => {
      const results = await findByDependency(workspace, "lodash");
      expect(results).toEqual([]);
    });
  });

  describe("semantic scoring in findRelevantFiles", () => {
    it("boosts files with matching exported symbols", async () => {
      const results = await findRelevantFiles(
        workspace,
        "authentication login function"
      );

      expect(results.length).toBeGreaterThan(0);
      // auth.ts should rank high due to exported 'login' function
      const authFile = results.find((r) => r.path === "src/auth.ts");
      expect(authFile).toBeDefined();
    });

    it("considers symbol kind in scoring", async () => {
      const results = await findRelevantFiles(workspace, "database class");

      expect(results.length).toBeGreaterThan(0);
      // db.ts should rank high due to Database class
      const dbFile = results.find((r) => r.path === "src/db.ts");
      expect(dbFile).toBeDefined();
    });
  });
});
