import { test, expect } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";
import { latestNode, openCommandPalette, spawnNode } from "./helpers/mindscape";

test.describe("Mindscape e2e", () => {
  test("end-to-end scenario across reloads and navigation", async ({ page }) => {
    await signUpTestUser(page);

    await spawnNode(page, "New Note");
    const noteNode = latestNode(page, "note");
    await noteNode.getByPlaceholder("Title (optional)").fill("E2E Note");
    await noteNode
      .getByPlaceholder("Write your note...")
      .fill("E2E body text");
    await noteNode.getByRole("button", { name: "Save" }).click();

    await page.reload({ waitUntil: "networkidle" });
    const persistedNote = latestNode(page, "note");
    await expect(persistedNote.getByText("E2E Note")).toBeVisible();

    await openCommandPalette(page);
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Create or jump to a node").fill("E2E Note");
    await dialog.getByText("E2E Note", { exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(persistedNote).toHaveClass(/selected/);

    await page.getByRole("link", { name: "Home" }).click();
    await expect(page.getByText("Orchestrator Run Viewer")).toBeVisible();

    await page.getByRole("link", { name: "Mindscape" }).click();
    await expect(page).toHaveURL(/\/mindscape$/);
    await expect(page.locator(".react-flow")).toBeVisible();
  });
});
