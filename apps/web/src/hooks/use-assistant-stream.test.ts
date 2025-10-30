import { describe, expect, it } from "bun:test";
import {
	parseAssistantChunk,
	updateActions,
	updateMessages,
	type AssistantAction,
	type AssistantMessage,
} from "./use-assistant-stream";

describe("parseAssistantChunk", () => {
	it("parses message delta events", () => {
		const chunk = {
			type: "message-delta",
			id: "msg-1",
			role: "assistant",
			delta: "Hello",
			ts: 1700000000000,
		};

		const normalized = parseAssistantChunk(chunk);

		expect(normalized).toMatchObject({
			kind: "message",
			id: "msg-1",
			role: "assistant",
			delta: "Hello",
			ts: 1700000000000,
		});
	});

	it("parses tool result failures", () => {
		const chunk = {
			type: "tool-result",
			toolCallId: "call-1",
			toolName: "note",
			error: "permission_denied",
		};

		const normalized = parseAssistantChunk(chunk);

		expect(normalized).toMatchObject({
			kind: "action",
			id: "call-1",
			tool: "note",
			status: "error",
			error: "permission_denied",
		});
	});

	it("parses status transitions", () => {
		const chunk = { type: "status", state: "connected" };
		const normalized = parseAssistantChunk(chunk);
		expect(normalized).toEqual({ kind: "status", status: "connected" });
	});

	it("parses stream errors with codes", () => {
		const chunk = { type: "error", message: "stream_failed", code: "E_STREAM" };
		const normalized = parseAssistantChunk(chunk);
		expect(normalized.kind).toBe("error");
		if (normalized.kind === "error") {
			expect(normalized.error.message).toBe("stream_failed");
			expect(normalized.error.name).toBe("E_STREAM");
		}
	});
});

describe("updateMessages", () => {
	it("appends new assistant messages and updates in place", () => {
		const initial: AssistantMessage[] = [];

		const first = updateMessages(initial, {
			id: "msg-1",
			role: "assistant",
			content: "Hello",
			ts: 1700000000000,
		});

		expect(first).toHaveLength(1);
		expect(first[0]?.content).toBe("Hello");

		const second = updateMessages(first, {
			id: "msg-1",
			role: "assistant",
			content: "Hello world",
			ts: 1700000001000,
		});

		expect(second[0]?.content).toBe("Hello world");
		expect(second[0]?.timestamp.getTime()).toBe(1700000001000);

		const unchanged = updateMessages(second, {
			id: "msg-1",
			role: "assistant",
			content: "Hello world",
			ts: 1700000002000,
		});

		expect(unchanged).toBe(second);
	});
});

describe("updateActions", () => {
	it("upserts tool actions", () => {
		const initial: AssistantAction[] = [];
		const args = { reminder: "Call mom" };

		const running = updateActions(initial, {
			id: "call-1",
			tool: "remind",
			args,
			status: "running",
		});

		expect(running).toHaveLength(1);
		expect(running[0]?.status).toBe("running");

		const resultPayload = { ok: true };
		const completed = updateActions(running, {
			id: "call-1",
			tool: "remind",
			args,
			status: "completed",
			result: resultPayload,
		});

		expect(completed[0]?.status).toBe("completed");
		expect(completed[0]?.result).toBe(resultPayload);

		const stable = updateActions(completed, {
			id: "call-1",
			tool: "remind",
			args,
			status: "completed",
			result: resultPayload,
		});

		expect(stable).toBe(completed);
	});
});
