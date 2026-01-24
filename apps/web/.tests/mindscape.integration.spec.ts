import { expect, test } from "@playwright/test";

import { signUpTestUser } from "./helpers/auth";
import { latestNode, spawnNode } from "./helpers/mindscape";

function futureDateMinutes(minutesAhead: number) {
  const date = new Date(Date.now() + minutesAhead * 60_000);
  const tz = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - tz);
  return local.toISOString().slice(0, 16);
}

test.describe("Mindscape integration", () => {
  test("core CRUD nodes persist via tRPC", async ({ page }) => {
    await signUpTestUser(page);

    // Note
    await spawnNode(page, "New Note");
    const noteNode = latestNode(page, "note");
    await noteNode
      .getByPlaceholder("Title (optional)")
      .fill("Integration Note");
    await noteNode
      .getByPlaceholder("Write your note...")
      .fill("Mindscape integration body");
    await noteNode.getByRole("button", { name: "Save" }).click();
    await expect(
      noteNode.getByText("Mindscape integration body")
    ).toBeVisible();

    // Reminder
    await spawnNode(page, "New Reminder");
    const reminderNode = latestNode(page, "reminder");
    await reminderNode
      .getByPlaceholder("Reminder title")
      .fill("Integration Reminder");
    await reminderNode
      .locator('input[type="datetime-local"]')
      .fill(futureDateMinutes(30));
    await reminderNode
      .getByPlaceholder("Description (optional)")
      .fill("Follow up on integration test");
    await reminderNode.getByRole("button", { name: "Save" }).click();
    await expect(reminderNode.getByText(/Due/i)).toBeVisible();

    // Timer
    await spawnNode(page, "Timer Board");
    const timerNode = latestNode(page, "timer");
    await timerNode.getByPlaceholder("Minutes").fill("1");
    await timerNode
      .getByPlaceholder("Label (optional)")
      .fill("Integration Timer");
    await timerNode.getByRole("button", { name: /start/i }).click();
    await expect(timerNode.getByText(/Integration Timer/)).toBeVisible();
    await timerNode.getByRole("button", { name: /Done/i }).click();

    // Bookmark
    await spawnNode(page, "Bookmark Node");
    const bookmarkNode = latestNode(page, "bookmark");
    const bookmarkUrl = `https://example.com/${Date.now()}`;
    await bookmarkNode
      .getByPlaceholder("https://example.com")
      .fill(bookmarkUrl);
    await bookmarkNode
      .getByPlaceholder("Title (optional)")
      .fill("Integration Bookmark");
    await bookmarkNode
      .getByPlaceholder("Tags (comma separated)")
      .fill("mindscape,tests");
    await bookmarkNode.getByRole("button", { name: "Add Bookmark" }).click();
    await expect(
      bookmarkNode.getByRole("link", { name: "Integration Bookmark" })
    ).toBeVisible();

    // Todo
    await spawnNode(page, "Todo List");
    const todoNode = latestNode(page, "todo");
    await todoNode
      .getByPlaceholder("Add a task")
      .fill("Mindscape integration todo");
    await todoNode.getByRole("button", { name: "Add" }).click();
    const todoItem = todoNode.getByText("Mindscape integration todo");
    await expect(todoItem).toBeVisible();
    await todoNode.getByRole("checkbox").check();
    await todoNode.getByRole("button", { name: "Completed" }).click();
    await expect(todoNode.getByText(/No completed tasks/i)).toBeVisible();
  });
});
