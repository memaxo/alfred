import { expect, test } from "@playwright/test";
import { signUpTestUser } from "./helpers/auth";
import { latestNode, spawnNode } from "./helpers/mindscape";

test.describe("Mindscape smoke", () => {
  test("new user can spawn and save a note", async ({ page }) => {
    await signUpTestUser(page);

    await spawnNode(page, "New Note");
    const noteNode = latestNode(page, "note");
    await expect(noteNode).toBeVisible();

    await noteNode.getByPlaceholder("Title (optional)").fill("Smoke Note");
    await noteNode
      .getByPlaceholder("Write your note...")
      .fill("Mindscape smoke body");
    await noteNode.getByRole("button", { name: "Save" }).click();

    await expect(noteNode.getByText("Mindscape smoke body")).toBeVisible();
  });
});
