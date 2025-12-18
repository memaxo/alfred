/**
 * Reminders E2E Flow Tests
 *
 * These tests exercise the full reminder CRUD flow through the real tRPC router
 * and database. They verify that the reminder APIs work correctly end-to-end.
 *
 * Requirements:
 * - PostgreSQL database running on localhost:5432
 * - Set RUN_DB_TESTS=1 to enable these tests
 *
 * See ExecPlan: docs/execplans/ui-testing-coverage-improvements.md (Milestone 5)
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createTestClient } from "@/test/client";
import { createTestServer, type TestServer } from "@/test/server";

const shouldRun = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!shouldRun)("Reminder E2E Flow", () => {
  let server: TestServer;
  let client: ReturnType<typeof createTestClient>;

  beforeAll(async () => {
    server = await createTestServer();
    client = createTestClient(server);
  });

  afterAll(async () => {
    if (server) {
      await server.stop();
    }
  });

  it("creates and lists a reminder", async () => {
    // Create a reminder
    const due = new Date(Date.now() + 3_600_000).toISOString(); // 1 hour from now
    const created = await client.remind.create.mutate({
      title: "Test Reminder E2E",
      due,
      description: "Test description for E2E",
    });

    expect(created).toBeDefined();
    expect(created.id).toBeDefined();
    expect(created.title).toBe("Test Reminder E2E");

    // List reminders and verify our created reminder appears
    const list = await client.remind.list.query({ limit: 100 });
    expect(list.length).toBeGreaterThan(0);

    const found = list.find((r) => r.id === created.id);
    expect(found).toBeDefined();
    expect(found?.title).toBe("Test Reminder E2E");
    expect(found?.description).toBe("Test description for E2E");
  });

  it("retrieves due reminders", async () => {
    // Create a due reminder (past due)
    const pastDue = new Date(Date.now() - 1000).toISOString();
    const created = await client.remind.create.mutate({
      title: "Due Reminder E2E",
      due: pastDue,
    });

    expect(created.id).toBeDefined();

    // Get due reminders
    const dueList = await client.remind.due.query({
      before: new Date().toISOString(),
    });

    // Should include our past-due reminder
    expect(dueList.length).toBeGreaterThan(0);
    const found = dueList.find((r) => r.id === created.id);
    expect(found).toBeDefined();
    expect(found?.title).toBe("Due Reminder E2E");
  });

  it("fires and deletes a reminder", async () => {
    // Create a reminder
    const due = new Date(Date.now() + 3_600_000).toISOString();
    const created = await client.remind.create.mutate({
      title: "Fire Delete E2E",
      due,
    });

    expect(created.id).toBeDefined();

    // Fire the reminder
    const fireResult = await client.remind.fire.mutate({ id: created.id });
    expect(fireResult.updated).toBe(true);

    // Verify it's still in the list (fired but not deleted)
    const listAfterFire = await client.remind.list.query({ limit: 100 });
    const foundAfterFire = listAfterFire.find((r) => r.id === created.id);
    expect(foundAfterFire).toBeDefined();
    expect(foundAfterFire?.firedAt).toBeDefined();

    // Delete the reminder
    const deleteResult = await client.remind.delete.mutate({ id: created.id });
    expect(deleteResult.deleted).toBe(true);

    // Verify it's removed from the list
    const listAfterDelete = await client.remind.list.query({ limit: 100 });
    const foundAfterDelete = listAfterDelete.find((r) => r.id === created.id);
    expect(foundAfterDelete).toBeUndefined();
  });

  it("handles pagination correctly", async () => {
    // Create multiple reminders
    const reminders: Array<{ id: string }> = [];
    for (let i = 0; i < 5; i++) {
      const due = new Date(Date.now() + 3_600_000 * (i + 1)).toISOString();
      const created = await client.remind.create.mutate({
        title: `Pagination Test ${i}`,
        due,
      });
      reminders.push(created);
    }

    // Test pagination
    const page1 = await client.remind.list.query({ limit: 2, offset: 0 });
    expect(page1.length).toBe(2);

    const page2 = await client.remind.list.query({ limit: 2, offset: 2 });
    expect(page2.length).toBe(2);

    // Ensure different items
    const page1Ids = page1.map((r) => r.id);
    const page2Ids = page2.map((r) => r.id);
    expect(page1Ids).not.toEqual(page2Ids);

    // Clean up
    for (const reminder of reminders) {
      await client.remind.delete.mutate({ id: reminder.id });
    }
  });
});
