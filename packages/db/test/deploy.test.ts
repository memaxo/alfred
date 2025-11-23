import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import { sql } from "drizzle-orm";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describePostgres : describe.skip;

const TEST_USER = "repo-deploy-test";

let deployRepo: typeof import("@alfred/db").deployRepo;
let db: typeof import("@alfred/db").db;

async function resetDeployTables() {
  if (!db) {
    return;
  }
  await db.execute(
    sql`TRUNCATE deployments RESTART IDENTITY CASCADE`
  );
}

describeFn("deployRepo", () => {
  beforeAll(async () => {
    requirePostgresTestEnv(
      "deployRepo tests require Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
    );
    const mod = await import("@alfred/db");
    deployRepo = mod.deployRepo;
    db = mod.db;
  });

  beforeEach(async () => {
    await resetDeployTables();
  });

  it("upserts and retrieves a deployment", async () => {
    const initial = await deployRepo.upsertDeployment({
      userId: TEST_USER,
      app: "test-app",
      type: "preview",
      status: "pending",
      metadata: { version: 1 },
    });

    expect(initial.userId).toBe(TEST_USER);
    expect(initial.app).toBe("test-app");
    expect(initial.type).toBe("preview");
    expect(initial.status).toBe("pending");
    expect(initial.created).toBeDefined();

    const updated = await deployRepo.upsertDeployment({
      userId: TEST_USER,
      app: "test-app",
      type: "preview",
      status: "running",
      url: "https://test-app.local",
      metadata: { version: 2 },
    });

    expect(updated.id).toBe(initial.id);
    expect(updated.status).toBe("running");
    expect(updated.url).toBe("https://test-app.local");
    // Check if metadata was merged or replaced (implementation suggests replace/patch)
    expect(updated.metadata).toEqual({ version: 2 });

    const fetched = await deployRepo.getDeploymentById(initial.id);
    expect(fetched?.status).toBe("running");
  });

  it("handles distinct deployments for different types", async () => {
    const preview = await deployRepo.upsertDeployment({
      userId: TEST_USER,
      app: "test-app",
      type: "preview",
      status: "running",
    });

    const production = await deployRepo.upsertDeployment({
      userId: TEST_USER,
      app: "test-app",
      type: "production",
      status: "running",
    });

    expect(preview.id).not.toBe(production.id);

    const latestPreview = await deployRepo.getDeploymentByApp(TEST_USER, "test-app", "preview");
    expect(latestPreview?.id).toBe(preview.id);

    const latestProd = await deployRepo.getDeploymentByApp(TEST_USER, "test-app", "production");
    expect(latestProd?.id).toBe(production.id);
  });

  it("lists deployments with filters", async () => {
    await deployRepo.createDeployment({
      userId: TEST_USER,
      app: "app-1",
      type: "preview",
      status: "running",
    });
    await deployRepo.createDeployment({
      userId: TEST_USER,
      app: "app-1",
      type: "preview",
      status: "stopped",
    });
    await deployRepo.createDeployment({
      userId: TEST_USER,
      app: "app-2",
      type: "preview",
      status: "running",
    });
    await deployRepo.createDeployment({
      userId: "other-user",
      app: "app-1",
      type: "preview",
      status: "running",
    });

    const userApps = await deployRepo.listDeployments({ userId: TEST_USER });
    expect(userApps.length).toBe(3);

    const app1 = await deployRepo.listDeployments({ userId: TEST_USER, app: "app-1" });
    expect(app1.length).toBe(2);

    const running = await deployRepo.listDeployments({ userId: TEST_USER, status: "running" });
    expect(running.length).toBe(2);
    expect(running.some(d => d.app === "app-1")).toBe(true);
    expect(running.some(d => d.app === "app-2")).toBe(true);
  });

  it("updates deployment status and sets timestamps", async () => {
    const deployment = await deployRepo.createDeployment({
      userId: TEST_USER,
      app: "status-test",
      type: "preview",
      status: "pending",
    });

    expect(deployment.deployed).toBeNull();
    expect(deployment.stopped).toBeNull();

    const running = await deployRepo.setDeploymentStatus(deployment.id, "running", {
      url: "https://app.test",
    });
    expect(running?.status).toBe("running");
    expect(running?.deployed).toBeDefined();
    expect(running?.url).toBe("https://app.test");

    const stopped = await deployRepo.setDeploymentStatus(deployment.id, "stopped");
    expect(stopped?.status).toBe("stopped");
    expect(stopped?.stopped).toBeDefined();
  });

  it("records health checks", async () => {
    const deployment = await deployRepo.createDeployment({
      userId: TEST_USER,
      app: "health-test",
      type: "preview",
      status: "running",
    });

    expect(deployment.lastHealthCheck).toBeNull();
    expect(deployment.healthStatus).toBeNull();

    const healthy = await deployRepo.recordHealthCheck(deployment.id, "healthy", {
      healthUrl: "http://health.check",
    });
    expect(healthy?.healthStatus).toBe("healthy");
    expect(healthy?.healthUrl).toBe("http://health.check");
    expect(healthy?.lastHealthCheck).toBeDefined();

    const unhealthy = await deployRepo.recordHealthCheck(deployment.id, "unhealthy");
    expect(unhealthy?.healthStatus).toBe("unhealthy");
    // Should preserve existing healthUrl if not provided, or update? 
    // Implementation `sanitize` filters undefined, so it should preserve if passed empty object?
    // Actually recordHealthCheck implementation explicitly accepts `{ healthUrl }`. 
    // If passed as undefined in optional arg, it won't be in patch.
    // Let's check behavior.
    expect(unhealthy?.healthUrl).toBe("http://health.check"); 
  });

  it("identifies stale deployments", async () => {
    const now = new Date();
    const staleTime = new Date(now.getTime() - 1000 * 60 * 10); // 10 mins ago

    // Stale because no health check
    const noHealth = await deployRepo.createDeployment({
      userId: TEST_USER,
      app: "stale-1",
      status: "running",
    });

    // Stale because old health check
    const oldHealth = await deployRepo.createDeployment({
      userId: TEST_USER,
      app: "stale-2",
      status: "running",
      lastHealthCheck: staleTime, // manually setting for test setup if schema allows?
      // schema usually defaults this. createDeployment takes Insert type.
      // Let's try setting it in recordHealthCheck or manually via db update if needed.
      // createDeployment inputs DeploymentInsert, which allows lastHealthCheck.
    });

    // Fresh
    const fresh = await deployRepo.createDeployment({
      userId: TEST_USER,
      app: "fresh",
      status: "running",
      lastHealthCheck: now,
    });

    // Stopped (should not be stale)
    await deployRepo.createDeployment({
      userId: TEST_USER,
      app: "stopped",
      status: "stopped",
      lastHealthCheck: staleTime,
    });

    const staleThreshold = new Date(now.getTime() - 1000 * 60 * 5); // 5 mins ago
    const staleList = await deployRepo.getStaleDeployments(staleThreshold);

    const ids = staleList.map(d => d.id);
    expect(ids).toContain(noHealth.id);
    expect(ids).toContain(oldHealth.id); // Depending on precision, this should match
    expect(ids).not.toContain(fresh.id);
  });

  it("soft deletes deployments", async () => {
    const deployment = await deployRepo.createDeployment({
      userId: TEST_USER,
      app: "delete-test",
    });

    const deleted = await deployRepo.deleteDeployment(deployment.id);
    expect(deleted?.id).toBe(deployment.id);

    const check = await deployRepo.getDeploymentById(deployment.id);
    expect(check).toBeNull();
  });
});
