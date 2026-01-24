import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

const TEST_USER_ID = "project-repo-test-user";

let projectRepo: typeof import("@alfred/db").projectRepo;
let db: typeof import("@alfred/db").db;

async function setupTestData() {
  if (!db) {
    return;
  }
  // Ensure user exists
  await db.execute(sql`
    INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
    VALUES (${TEST_USER_ID}, 'Test User', 'project@test.com', true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);
}

async function resetProjectTables() {
  if (!db) {
    return;
  }
  await db.execute(sql`TRUNCATE projects RESTART IDENTITY CASCADE`);
}

describeFn("projectRepo", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "projectRepo tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const mod = await import("@alfred/db");
    projectRepo = mod.projectRepo;
    db = mod.db;
    await setupTestData();
  });

  beforeEach(async () => {
    await resetProjectTables();
  });

  it("creates and retrieves a project by workspace", async () => {
    const workspace = "/Users/test/alfred";
    const project = await projectRepo.createProject({
      userId: TEST_USER_ID,
      name: "alfred",
      slug: "alfred",
      workspace,
      config: { framework: "tanstack" },
    });

    expect(project.id).toBeDefined();
    expect(project.name).toBe("alfred");
    expect(project.workspace).toBe(workspace);

    const retrieved = await projectRepo.getProjectByWorkspace(
      TEST_USER_ID,
      workspace
    );
    expect(retrieved?.id).toBe(project.id);
  });

  it("lists projects for a user", async () => {
    await projectRepo.createProject({
      userId: TEST_USER_ID,
      name: "project-a",
      slug: "project-a",
      workspace: "/path/a",
    });
    await projectRepo.createProject({
      userId: TEST_USER_ID,
      name: "project-b",
      slug: "project-b",
      workspace: "/path/b",
    });

    const projects = await projectRepo.getProjectsByUserId(TEST_USER_ID);
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.name)).toContain("project-a");
    expect(projects.map((p) => p.name)).toContain("project-b");
  });

  it("updates project last active timestamp", async () => {
    const project = await projectRepo.createProject({
      userId: TEST_USER_ID,
      name: "alfred",
      slug: "alfred",
      workspace: "/path",
    });

    expect(project.lastActiveAt).toBeNull();

    await projectRepo.updateProjectLastActive(project.id);

    const updated = await projectRepo.getProjectById(project.id);
    expect(updated?.lastActiveAt).not.toBeNull();
  });

  it("updates project config and conventions", async () => {
    const project = await projectRepo.createProject({
      userId: TEST_USER_ID,
      name: "alfred",
      slug: "alfred",
      workspace: "/path",
    });

    const newConfig = { framework: "nextjs" };
    await projectRepo.updateProjectConfig(project.id, newConfig);

    const withConfig = await projectRepo.getProjectById(project.id);
    expect(withConfig?.config).toEqual(newConfig);

    const conventions = [
      { id: "c1", description: "Use tabs", confidence: 1.0 },
    ];
    await projectRepo.updateProjectConventions(project.id, conventions);

    const withConventions = await projectRepo.getProjectById(project.id);
    expect(withConventions?.conventions).toEqual(conventions);
  });

  it("enforces unique user+workspace constraint", async () => {
    const workspace = "/same/path";
    await projectRepo.createProject({
      userId: TEST_USER_ID,
      name: "p1",
      slug: "p1",
      workspace,
    });

    await expect(
      projectRepo.createProject({
        userId: TEST_USER_ID,
        name: "p2",
        slug: "p2",
        workspace,
      })
    ).rejects.toThrow();
  });
});
