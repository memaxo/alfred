import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import * as workflowRepo from "@alfred/db/repo/workflow";
import type { WorkflowEvent } from "@alfred/type";
import { sql } from "drizzle-orm";
import { closeTestDb, createTestDb, truncateTables } from "./utils/db";

const SHOULD_RUN = process.env.RUN_DB_TESTS === "1";
const describeFn = SHOULD_RUN ? describe : describe.skip;

let testDbHarness: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  if (!SHOULD_RUN) {
    return;
  }
  testDbHarness = await createTestDb();
});

afterAll(async () => {
  if (!SHOULD_RUN) return;
  await closeTestDb(testDbHarness);
});

beforeEach(async () => {
  if (!SHOULD_RUN) return;
  await truncateTables(testDbHarness.db);
  await testDbHarness.db.execute(
    sql`TRUNCATE workflow_runs, workflow_events RESTART IDENTITY CASCADE`
  );
});

afterEach(async () => {
  if (!SHOULD_RUN) return;
  await truncateTables(testDbHarness.db);
});

describeFn("workflow persistence", () => {
  const TEST_USER = "workflow-persistence-test-user";

  describe("createRun", () => {
    it("creates a workflow run", async () => {
      const run = await workflowRepo.createRun({
        userId: TEST_USER,
        workflowId: "plan",
        status: "running",
        inputData: { requirement: "test" },
      });

      expect(run.id).toBeDefined();
      expect(run.userId).toBe(TEST_USER);
      expect(run.workflowId).toBe("plan");
      expect(run.status).toBe("running");
    });

    it("creates run with custom ID", async () => {
      const customId = "custom-run-id";
      const run = await workflowRepo.createRun({
        id: customId,
        userId: TEST_USER,
        workflowId: "plan",
      });

      expect(run.id).toBe(customId);
    });
  });

  describe("updateRun", () => {
    it("updates run status", async () => {
      const run = await workflowRepo.createRun({
        userId: TEST_USER,
        workflowId: "plan",
        status: "running",
      });

      const updated = await workflowRepo.updateRun(run.id, {
        status: "completed",
        completedAt: new Date(),
      });

      expect(updated?.status).toBe("completed");
      expect(updated?.completedAt).toBeDefined();
    });

    it("updates run with error message", async () => {
      const run = await workflowRepo.createRun({
        userId: TEST_USER,
        workflowId: "plan",
        status: "running",
      });

      const updated = await workflowRepo.updateRun(run.id, {
        status: "failed",
        errorMessage: "test error",
      });

      expect(updated?.status).toBe("failed");
      expect(updated?.errorMessage).toBe("test error");
    });
  });

  describe("appendEvent", () => {
    it("appends events to a run", async () => {
      const run = await workflowRepo.createRun({
        userId: TEST_USER,
        workflowId: "plan",
        status: "running",
      });

      const event1: WorkflowEvent = {
        type: "run",
        id: run.id,
      } as WorkflowEvent;

      const event2: WorkflowEvent = {
        type: "progress",
        pct: 50,
        message: "halfway",
      } as WorkflowEvent;

      await workflowRepo.appendEvent({
        runId: run.id,
        eventType: "run",
        eventData: event1,
      });

      await workflowRepo.appendEvent({
        runId: run.id,
        eventType: "progress",
        eventData: event2,
      });

      const events = await workflowRepo.listEvents(run.id);
      expect(events.length).toBe(2);
      expect(events[0].eventType).toBe("progress");
      expect(events[1].eventType).toBe("run");
    });

    it("orders events by timestamp (newest first)", async () => {
      const run = await workflowRepo.createRun({
        userId: TEST_USER,
        workflowId: "plan",
      });

      await workflowRepo.appendEvent({
        runId: run.id,
        eventType: "event1",
        timestamp: new Date("2024-01-01"),
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await workflowRepo.appendEvent({
        runId: run.id,
        eventType: "event2",
        timestamp: new Date("2024-01-02"),
      });

      const events = await workflowRepo.listEvents(run.id);
      expect(events[0].eventType).toBe("event2");
      expect(events[1].eventType).toBe("event1");
    });
  });

  describe("listEvents", () => {
    it("returns events for a run", async () => {
      const run = await workflowRepo.createRun({
        userId: TEST_USER,
        workflowId: "plan",
      });

      await workflowRepo.appendEvent({
        runId: run.id,
        eventType: "test",
        eventData: { test: "data" },
      });

      const events = await workflowRepo.listEvents(run.id);
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe("test");
    });

    it("returns empty array for run with no events", async () => {
      const run = await workflowRepo.createRun({
        userId: TEST_USER,
        workflowId: "plan",
      });

      const events = await workflowRepo.listEvents(run.id);
      expect(events).toEqual([]);
    });
  });

  describe("getRun", () => {
    it("retrieves a run by ID", async () => {
      const created = await workflowRepo.createRun({
        userId: TEST_USER,
        workflowId: "plan",
        status: "running",
      });

      const retrieved = await workflowRepo.getRun(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.userId).toBe(TEST_USER);
    });

    it("returns null for non-existent run", async () => {
      const retrieved = await workflowRepo.getRun("nonexistent-id");
      expect(retrieved).toBeNull();
    });
  });

  describe("event replay", () => {
    it("can replay events in order", async () => {
      const run = await workflowRepo.createRun({
        userId: TEST_USER,
        workflowId: "plan",
      });

      const events: WorkflowEvent[] = [
        { type: "run", id: run.id } as WorkflowEvent,
        { type: "progress", pct: 25 } as WorkflowEvent,
        { type: "progress", pct: 50 } as WorkflowEvent,
        { type: "progress", pct: 100, message: "completed" } as WorkflowEvent,
      ];

      for (const event of events) {
        await workflowRepo.appendEvent({
          runId: run.id,
          eventType: event.type ?? "event",
          eventData: event,
        });
      }

      const replayed = await workflowRepo.listEvents(run.id);
      expect(replayed.length).toBe(events.length);
    });
  });
});
