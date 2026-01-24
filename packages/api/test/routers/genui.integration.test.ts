/**
 * GenUI Router Integration Tests
 *
 * Tests the GenUI form submission flow end-to-end:
 * - Form submission via tRPC
 * - Conversation injection
 * - Schema persistence
 * - Validation
 */

process.env.DATABASE_URL = "sqlite::memory:";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";

import type { UIComponent } from "@alfred/type/genui";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { randomUUID } from "node:crypto";

import { createTestCaller } from "../utils/trpc";

describe("genui router", () => {
  let caller: Awaited<ReturnType<typeof createTestCaller>>;
  let conversationId: string;
  let userId: string;

  beforeAll(async () => {
    caller = await createTestCaller();
    userId = caller.ctx.session.user.id;
  });

  beforeEach(() => {
    conversationId = `conv-${randomUUID()}`;
  });

  afterAll(async () => {
    // Cleanup handled by test harness
  });

  describe("submit", () => {
    it("requires authentication", async () => {
      const unauthedCaller = await import("../utils/trpc").then((m) =>
        m.createUnauthedCaller()
      );
      await expect(
        unauthedCaller.genui.submit({
          formId: "test-form",
          conversationId: "test-conv",
          data: {},
        })
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("submits form data and injects into conversation", async () => {
      const formId = `form-${randomUUID()}`;
      const formData = {
        name: "Test User",
        email: "test@example.com",
        age: 30,
      };

      const result = await caller.genui.submit({
        formId,
        conversationId,
        data: formData,
      });

      expect(result).toEqual({ success: true });

      // Verify message was created in conversation
      const conversationRepo = await import("@alfred/db/repo/conversation");
      const messages = await conversationRepo.getMessages(
        userId,
        conversationId
      );

      expect(messages.length).toBe(1);
      const message = messages[0];
      expect(message.role).toBe("assistant");
      expect(message.parts.length).toBe(1);

      const part = message.parts[0];
      if (part.type === "tool-result") {
        expect(part.toolName).toBe(`form_${formId}`);
        expect(part.output).toMatchObject({
          formId,
          data: formData,
          submittedAt: expect.any(String),
        });
      } else {
        throw new Error(`Expected tool-result part, got ${part.type}`);
      }
    });

    it("associates form submission with tool call when toolCallId provided", async () => {
      const formId = `form-${randomUUID()}`;
      const toolCallId = `tool-${randomUUID()}`;
      const formData = { value: "test" };

      await caller.genui.submit({
        formId,
        conversationId,
        toolCallId,
        data: formData,
      });

      const conversationRepo = await import("@alfred/db/repo/conversation");
      const messages = await conversationRepo.getMessages(
        userId,
        conversationId
      );

      expect(messages.length).toBe(1);
      const part = messages[0].parts[0];
      if (part.type === "tool-result") {
        expect(part.toolCallId).toBe(toolCallId);
      } else {
        throw new Error(`Expected tool-result part, got ${part.type}`);
      }
    });

    it("persists schema when provided", async () => {
      const formId = `form-${randomUUID()}`;
      const schema: UIComponent = {
        component: "text",
        props: { label: "Name", required: true },
      };
      const formData = { name: "Test" };

      await caller.genui.submit({
        formId,
        conversationId,
        data: formData,
        schema,
      });

      const conversationRepo = await import("@alfred/db/repo/conversation");
      const messages = await conversationRepo.getMessages(
        userId,
        conversationId
      );

      const part = messages[0].parts[0];
      if (part.type === "tool-result") {
        expect(part.output).toMatchObject({
          formId,
          data: formData,
          schema: expect.objectContaining({
            component: "text",
          }),
        });
      } else {
        throw new Error(`Expected tool-result part, got ${part.type}`);
      }
    });

    it("handles multiple form submissions in same conversation", async () => {
      const formId1 = `form-${randomUUID()}`;
      const formId2 = `form-${randomUUID()}`;

      await caller.genui.submit({
        formId: formId1,
        conversationId,
        data: { step: 1 },
      });

      await caller.genui.submit({
        formId: formId2,
        conversationId,
        data: { step: 2 },
      });

      const conversationRepo = await import("@alfred/db/repo/conversation");
      const messages = await conversationRepo.getMessages(
        userId,
        conversationId
      );

      expect(messages.length).toBe(2);
      expect(messages[0].parts[0]).toMatchObject({
        type: "tool-result",
        output: expect.objectContaining({ formId: formId1 }),
      });
      expect(messages[1].parts[0]).toMatchObject({
        type: "tool-result",
        output: expect.objectContaining({ formId: formId2 }),
      });
    });

    it("validates input schema", async () => {
      await expect(
        caller.genui.submit({
          formId: "", // Empty formId should fail
          conversationId,
          data: {},
        })
      ).rejects.toThrow();

      await expect(
        caller.genui.submit({
          formId: "test",
          conversationId: "", // Empty conversationId should fail
          data: {},
        })
      ).rejects.toThrow();
    });

    it("handles complex nested form data", async () => {
      const formId = `form-${randomUUID()}`;
      const complexData = {
        user: {
          name: "Test",
          preferences: {
            theme: "dark",
            notifications: true,
          },
        },
        tags: ["tag1", "tag2"],
        metadata: null,
      };

      await caller.genui.submit({
        formId,
        conversationId,
        data: complexData,
      });

      const conversationRepo = await import("@alfred/db/repo/conversation");
      const messages = await conversationRepo.getMessages(
        userId,
        conversationId
      );

      const part = messages[0].parts[0];
      if (part.type === "tool-result") {
        expect(part.output.data).toEqual(complexData);
      } else {
        throw new Error(`Expected tool-result part, got ${part.type}`);
      }
    });
  });
});
