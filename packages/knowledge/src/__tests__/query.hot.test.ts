import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

const ORIGINAL_DB_URL = process.env.DATABASE_URL;

let fast_getReflections: typeof import("../query.hot").fast_getReflections;
let db: typeof import("@alfred/db").db;
let memoryNodes: typeof import("@alfred/db/schema/graph").memoryNodes;

beforeAll(async () => {
  process.env.DATABASE_URL = "sqlite::memory:";
  ({ fast_getReflections } = await import("../query.hot"));
  const dbModule = await import("@alfred/db");
  db = dbModule.db;
  ({ memoryNodes } = await import("@alfred/db/schema/graph"));
});

afterEach(async () => {
  await db.delete(memoryNodes).run();
});

afterAll(() => {
  if (ORIGINAL_DB_URL === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = ORIGINAL_DB_URL;
  }
});

describe("fast_getReflections", () => {
  it("returns newest reflections for an explicit resource", async () => {
    const resource = `resource-${Date.now()}`;
    await insertReflection({
      resource,
      label: "older",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      derived: ["alpha"],
      confidence: 0.4,
    });
    await insertReflection({
      resource,
      label: "newer",
      createdAt: new Date("2025-02-01T00:00:00.000Z"),
      derived: ["beta", "gamma"],
      confidence: 0.91,
    });

    const reflections = await fast_getReflections("any-user", {
      resource,
      limit: 1,
    });

    expect(reflections).toHaveLength(1);
    expect(reflections[0]?.conclusion).toBe("newer");
    expect(reflections[0]?.resource).toBe(resource);
    expect(reflections[0]?.derived).toEqual(["beta", "gamma"]);
    expect(reflections[0]?.confidence).toBeCloseTo(0.91, 2);
  });

  it("falls back to global reflections when scoped lookup is empty", async () => {
    const resource = `global-${Date.now()}`;
    await insertReflection({ resource, label: "global insight" });

    const reflections = await fast_getReflections("missing-user", { limit: 5 });

    expect(reflections).toHaveLength(1);
    expect(reflections[0]?.resource).toBe(resource);
    expect(reflections[0]?.conclusion).toBe("global insight");
  });

  it("sanitizes malformed confidence and derived fields", async () => {
    const resource = `resource-${randomUUID()}`;
    await db
      .insert(memoryNodes)
      .values({
        id: randomUUID(),
        resource,
        hash: `${resource}:sanitized`,
        kind: "insight",
        label: "sanitized",
        properties: {
          // Mixed data that should be filtered/clamped
          derived: ["valid", 42, null],
          confidence: 1.7,
        },
      })
      .run();

    const reflections = await fast_getReflections(resource);
    expect(reflections).toHaveLength(1);
    expect(reflections[0]?.derived).toEqual(["valid"]);
    expect(reflections[0]?.confidence).toBe(1);
  });
});

async function insertReflection(options: {
  resource: string;
  label: string;
  createdAt?: Date;
  derived?: string[];
  confidence?: number;
}) {
  await db
    .insert(memoryNodes)
    .values({
      id: randomUUID(),
      resource: options.resource,
      hash: `${options.resource}:${options.label}:${Date.now()}`,
      kind: "insight",
      label: options.label,
      created: options.createdAt,
      properties: {
        derived: options.derived,
        confidence: options.confidence,
      },
    })
    .run();
}
