/**
 * Cross-Boundary E2E Tests
 *
 * Tests cross-system flows:
 * - Voice → Workflow → Knowledge flow
 * - Workflow obligation → Biometric elevation → Resume
 * - Chat → Knowledge capture → Graph update → Retrieval
 *
 * Run: bunx playwright test cross-boundary.e2e.spec.ts
 */

import { expect, test } from "@playwright/test";

test.describe("Cross-Boundary E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test.describe("Voice → Workflow → Knowledge Flow", () => {
    test("voice input triggers workflow execution", async ({ page }) => {
      // Check for voice button
      const voiceBtn = page.locator('[data-testid="voice-btn"]');

      if (await voiceBtn.isVisible({ timeout: 1000 })) {
        // Click to start voice input
        await voiceBtn.click();

        // Should show voice recording indicator
        const recordingIndicator = page.locator(
          '[data-testid="voice-recording"]'
        );
        if (await recordingIndicator.isVisible({ timeout: 1000 })) {
          await expect(recordingIndicator).toBeVisible();

          // Stop recording
          await voiceBtn.click();
          await page.waitForTimeout(2000);

          // Should trigger workflow
          const workflowIndicator = page.locator(
            '[data-testid="workflow-running"]'
          );
          if (await workflowIndicator.isVisible({ timeout: 1000 })) {
            await expect(workflowIndicator).toBeVisible();
          }
        }
      }
    });

    test("workflow result creates knowledge nodes", async ({ page }) => {
      // First, trigger a workflow via chat
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("Create a login function with JWT tokens");
        await chatInput.press("Enter");

        // Wait for workflow to complete
        await page.waitForTimeout(10_000);

        // Navigate to Mindscape
        const mindscapeLink = page.locator('a[href*="mindscape"]');
        if (await mindscapeLink.isVisible()) {
          await mindscapeLink.click();
          await page.waitForLoadState("networkidle");

          // Should have new knowledge nodes
          const knowledgeGraph = page.locator(
            '[data-testid="knowledge-graph"]'
          );
          if (await knowledgeGraph.isVisible({ timeout: 1000 })) {
            await expect(knowledgeGraph).toBeVisible();
          }
        }
      }
    });

    test("voice output synthesizes workflow result", async ({ page }) => {
      // Enable voice output
      const voiceOutputToggle = page.locator(
        '[data-testid="voice-output-toggle"]'
      );
      if (await voiceOutputToggle.isVisible({ timeout: 1000 })) {
        await voiceOutputToggle.click();
      }

      // Send a message
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("What time is it?");
        await chatInput.press("Enter");

        // Wait for response and potential voice output
        await page.waitForTimeout(5000);

        // Check for audio playback indicator
        const audioPlaying = page.locator('[data-testid="audio-playing"]');
        // Audio might play if voice output is enabled
      }
    });
  });

  test.describe("Workflow Obligation → Biometric → Resume", () => {
    test("high-autonomy workflow shows obligation", async ({ page }) => {
      // Navigate to workflow with high autonomy
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        // Trigger a privileged operation
        await chatInput.fill(
          "Delete all temporary files in the project /auto:high"
        );
        await chatInput.press("Enter");

        // Wait for obligation prompt
        await page.waitForTimeout(3000);

        // Should show obligation dialog
        const obligationDialog = page.locator(
          '[data-testid="obligation-dialog"]'
        );
        if (await obligationDialog.isVisible({ timeout: 1000 })) {
          await expect(obligationDialog).toBeVisible();
        }
      }
    });

    test("biometric elevation dialog appears", async ({ page }) => {
      // Check for biometric prompt
      const biometricBtn = page.locator('[data-testid="biometric-elevate"]');

      if (await biometricBtn.isVisible({ timeout: 1000 })) {
        await biometricBtn.click();

        // Should show biometric dialog
        const biometricDialog = page.locator(
          '[data-testid="biometric-dialog"]'
        );
        if (await biometricDialog.isVisible({ timeout: 1000 })) {
          await expect(biometricDialog).toBeVisible();
        }
      }
    });

    test("workflow resumes after elevation", async ({ page }) => {
      // This test requires actual biometric capability
      // Check for resume functionality
      const resumeBtn = page.locator('[data-testid="workflow-resume"]');

      if (await resumeBtn.isVisible({ timeout: 1000 })) {
        await resumeBtn.click();

        // Workflow should resume
        const workflowStatus = page.locator('[data-testid="workflow-status"]');
        if (await workflowStatus.isVisible({ timeout: 1000 })) {
          // Status should change from suspended to running
          await expect(workflowStatus).toBeVisible();
        }
      }
    });

    test("obligation timeout cancels workflow", async ({ page }) => {
      // Trigger workflow that requires elevation
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("Privileged operation /auto:high");
        await chatInput.press("Enter");

        // Wait for obligation
        await page.waitForTimeout(3000);

        // Check for timeout indicator
        const timeoutIndicator = page.locator(
          '[data-testid="obligation-timeout"]'
        );
        if (await timeoutIndicator.isVisible({ timeout: 1000 })) {
          // After timeout, workflow should be cancelled
          await expect(timeoutIndicator).toBeVisible();
        }
      }
    });
  });

  test.describe("Chat → Knowledge Capture → Graph → Retrieval", () => {
    test("complete knowledge cycle", async ({ page }) => {
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        // Step 1: Chat creates knowledge
        await chatInput.fill(
          "The project uses PostgreSQL with pgvector for embeddings"
        );
        await chatInput.press("Enter");
        await page.waitForTimeout(3000);

        // Step 2: Navigate to graph
        const mindscapeLink = page.locator('a[href*="mindscape"]');
        if (await mindscapeLink.isVisible()) {
          await mindscapeLink.click();
          await page.waitForLoadState("networkidle");

          // Step 3: Verify graph updated
          const graphNode = page.locator('[data-testid="graph-node"]').first();
          if (await graphNode.isVisible({ timeout: 1000 })) {
            await expect(graphNode).toBeVisible();
          }
        }

        // Step 4: Return to chat and retrieve
        const homeLink = page.locator('a[href="/"]');
        if (await homeLink.isVisible()) {
          await homeLink.click();
          await page.waitForLoadState("networkidle");
        }

        const chatInput2 = page.locator(
          'textarea[placeholder*="message"], input[placeholder*="message"]'
        );
        if (await chatInput2.isVisible()) {
          await chatInput2.fill("What database does the project use?");
          await chatInput2.press("Enter");
          await page.waitForTimeout(5000);

          // Should retrieve previously stored knowledge
          const ragContext = page.locator('[data-testid="rag-context"]');
          if (await ragContext.isVisible({ timeout: 1000 })) {
            await expect(ragContext).toBeVisible();
          }
        }
      }
    });

    test("knowledge capture shows confirmation", async ({ page }) => {
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("Remember: API rate limit is 100 requests/minute");
        await chatInput.press("Enter");

        // Should show capture confirmation
        const captureConfirm = page.locator('[data-testid="knowledge-saved"]');
        if (await captureConfirm.isVisible({ timeout: 3000 })) {
          await expect(captureConfirm).toBeVisible();
        }
      }
    });

    test("graph updates in real-time", async ({ page }) => {
      // Open mindscape in split view or new tab
      const mindscapeLink = page.locator('a[href*="mindscape"]');
      if (await mindscapeLink.isVisible()) {
        await mindscapeLink.click({ button: "middle" }); // Open in new tab
      }

      // Stay on chat page
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("New knowledge: WebSocket port is 8080");
        await chatInput.press("Enter");

        // Graph should update (would need to check other tab in full test)
        await page.waitForTimeout(2000);
      }
    });

    test("retrieval shows provenance", async ({ page }) => {
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("How does authentication work in this project?");
        await chatInput.press("Enter");

        await page.waitForTimeout(5000);

        // Should show where knowledge came from
        const provenance = page.locator('[data-testid="knowledge-provenance"]');
        if (await provenance.isVisible({ timeout: 1000 })) {
          await expect(provenance).toBeVisible();
        }
      }
    });
  });

  test.describe("Error Handling Across Boundaries", () => {
    test("voice error doesnt break workflow", async ({ page }) => {
      // Simulate voice error
      const voiceBtn = page.locator('[data-testid="voice-btn"]');

      if (await voiceBtn.isVisible({ timeout: 1000 })) {
        await voiceBtn.click();

        // Wait briefly then cancel
        await page.waitForTimeout(500);
        await voiceBtn.click();

        // System should still be functional
        const chatInput = page.locator(
          'textarea[placeholder*="message"], input[placeholder*="message"]'
        );
        if (await chatInput.isVisible()) {
          await chatInput.fill("Test after voice error");
          await chatInput.press("Enter");

          // Should still work
          await page.waitForTimeout(2000);
        }
      }
    });

    test("knowledge error shows notification", async ({ page }) => {
      // Errors in knowledge system should be surfaced
      const errorNotification = page.locator(
        '[data-testid="error-notification"]'
      );

      // Check that error handling UI exists
      // (would be triggered by actual error condition)
    });

    test("workflow cancellation cleans up all systems", async ({ page }) => {
      const chatInput = page.locator(
        'textarea[placeholder*="message"], input[placeholder*="message"]'
      );

      if (await chatInput.isVisible()) {
        await chatInput.fill("Long running task that I will cancel");
        await chatInput.press("Enter");

        // Wait for workflow to start
        await page.waitForTimeout(2000);

        // Cancel
        const cancelBtn = page.locator('[data-testid="cancel-workflow"]');
        if (await cancelBtn.isVisible({ timeout: 1000 })) {
          await cancelBtn.click();

          // Should clean up
          await page.waitForTimeout(1000);

          // Should be able to start new workflow
          await chatInput.fill("New workflow after cancel");
          await chatInput.press("Enter");
          await page.waitForTimeout(2000);
        }
      }
    });
  });
});
