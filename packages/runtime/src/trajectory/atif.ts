import { unwrapEventEnvelope } from "@alfred/agent/utils/envelope";
import type { WorkflowEventType } from "@alfred/db/schema/workflow";
import type { UIMessage } from "@alfred/type/stream";

export type AtifSource = "user" | "agent" | "system";

export type AtifToolCall = {
  tool_call_id: string;
  function_name: string;
  arguments: unknown;
};

export type AtifObservationResult = {
  source_call_id: string;
  content: unknown;
};

export type AtifStep = {
  step_id: number;
  timestamp: string;
  source: AtifSource;
  message?: string;
  reasoning_content?: string;
  tool_calls?: AtifToolCall[];
  observation?: { results: AtifObservationResult[] };
  metrics?: unknown;
  extra?: Record<string, unknown>;
};

export type AtifTrajectory = {
  schema_version: string;
  session_id: string;
  agent: {
    name: string;
    version: string;
    model_name: string;
    extra?: Record<string, unknown>;
  };
  steps: AtifStep[];
  final_metrics?: {
    total_steps: number;
    total_prompt_tokens?: number;
    total_completion_tokens?: number;
    total_cached_tokens?: number;
    total_cost_usd?: number;
  };
  extra?: Record<string, unknown>;
};

export type PersistedWorkflowEvent = {
  eventId: string;
  eventType: WorkflowEventType | string;
  eventData: unknown;
  timestamp: Date | null;
  seq: number | null;
};

function coerceRecord(val: unknown): Record<string, unknown> {
  if (typeof val === "object" && val !== null && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

function coerceString(val: unknown): string | null {
  return typeof val === "string" && val.length > 0 ? val : null;
}

function safeIso(ts: Date | null): string {
  return (ts ?? new Date(0)).toISOString();
}

function mapUiRoleToAtifSource(role: UIMessage["role"]): AtifSource {
  if (role === "user") {
    return "user";
  }
  if (role === "assistant") {
    return "agent";
  }
  return "system";
}

function isUiMessageArray(val: unknown): val is UIMessage[] {
  return (
    Array.isArray(val) &&
    val.every((v) => typeof v === "object" && v !== null && "role" in v)
  );
}

function pullTextParts(msg: UIMessage): { text: string; reasoning: string } {
  const parts = Array.isArray(msg.parts) ? msg.parts : [];

  const text: string[] = [];
  const reasoning: string[] = [];

  for (const p of parts) {
    const pr = coerceRecord(p);
    const type = coerceString(pr.type);
    if (type === "text") {
      const t = coerceString(pr.text);
      if (t) {
        text.push(t);
      }
      continue;
    }
    if (type === "reasoning") {
      const t = coerceString(pr.text);
      if (t) {
        reasoning.push(t);
      }
    }
  }

  return {
    text: text.join(""),
    reasoning: reasoning.join("\n"),
  };
}

function pullToolParts(msg: UIMessage): {
  toolCalls: AtifToolCall[];
  obs: AtifObservationResult[];
} {
  const parts = Array.isArray(msg.parts) ? msg.parts : [];
  const toolCalls: AtifToolCall[] = [];
  const obs: AtifObservationResult[] = [];

  for (const p of parts) {
    const pr = coerceRecord(p);
    const type = coerceString(pr.type);
    if (!type) {
      continue;
    }

    if (type === "tool-call") {
      const toolCallId = coerceString(pr.toolCallId);
      const toolName = coerceString(pr.toolName);
      if (toolCallId && toolName) {
        toolCalls.push({
          tool_call_id: toolCallId,
          function_name: toolName,
          arguments: pr.input,
        });
      }
      continue;
    }

    if (type === "tool-result") {
      const toolCallId = coerceString(pr.toolCallId);
      if (toolCallId) {
        obs.push({ source_call_id: toolCallId, content: pr.output });
      }
      continue;
    }

    if (type === "dynamic-tool") {
      const toolCallId = coerceString(pr.toolCallId);
      const toolName = coerceString(pr.toolName);
      if (toolCallId && toolName) {
        toolCalls.push({
          tool_call_id: toolCallId,
          function_name: toolName,
          arguments: pr.input,
        });
        if (Object.hasOwn(pr, "output")) {
          obs.push({ source_call_id: toolCallId, content: pr.output });
        }
      }
      continue;
    }

    if (type.startsWith("tool-")) {
      const toolCallId = coerceString(pr.toolCallId);
      const functionName = type.slice("tool-".length);
      if (toolCallId && functionName.length > 0) {
        toolCalls.push({
          tool_call_id: toolCallId,
          function_name: functionName,
          arguments: pr.input,
        });
        if (Object.hasOwn(pr, "output")) {
          obs.push({ source_call_id: toolCallId, content: pr.output });
        }
      }
    }
  }

  return { toolCalls, obs };
}

function toolCallStep(args: {
  stepId: number;
  ts: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
  extra: Record<string, unknown>;
}): AtifStep {
  return {
    step_id: args.stepId,
    timestamp: args.ts,
    source: "agent",
    message: `tool_call:${args.toolName}`,
    tool_calls: [
      {
        tool_call_id: args.toolCallId,
        function_name: args.toolName,
        arguments: args.input,
      },
    ],
    extra: args.extra,
  };
}

function toolResultStep(args: {
  stepId: number;
  ts: string;
  toolCallId: string;
  toolName: string;
  output: unknown;
  extra: Record<string, unknown>;
}): AtifStep {
  return {
    step_id: args.stepId,
    timestamp: args.ts,
    source: "agent",
    message: `tool_result:${args.toolName}`,
    observation: {
      results: [{ source_call_id: args.toolCallId, content: args.output }],
    },
    extra: args.extra,
  };
}

export function buildAtifTrajectory(args: {
  runId: string;
  requirement?: string | null;
  events: PersistedWorkflowEvent[];
  schemaVersion?: string;
  agent?: { name: string; version: string; modelName: string };
}): AtifTrajectory {
  const schemaVersion = args.schemaVersion ?? "ATIF-v1.4";
  const agent = args.agent ?? {
    name: "alfred",
    version: "unknown",
    modelName: "unknown",
  };

  // Deterministic ordering: timestamp asc, then seq asc, then eventId asc.
  const ordered = [...args.events].sort((a, b) => {
    const at = (a.timestamp ?? new Date(0)).getTime();
    const bt = (b.timestamp ?? new Date(0)).getTime();
    if (at !== bt) {
      return at - bt;
    }
    const as = a.seq ?? -1;
    const bs = b.seq ?? -1;
    if (as !== bs) {
      return as - bs;
    }
    return a.eventId.localeCompare(b.eventId);
  });

  const steps: AtifStep[] = [];
  let stepId = 1;

  const requirement = args.requirement?.trim() ?? "";
  const hasUserUiMessage = ordered.some((e) => {
    if (e.eventType !== "ui-message") {
      return false;
    }
    const { data } = unwrapEventEnvelope(e.eventData);
    if (!isUiMessageArray(data)) {
      return false;
    }
    return data.some((m) => m.role === "user");
  });

  if (requirement.length > 0 && !hasUserUiMessage) {
    steps.push({
      step_id: stepId++,
      timestamp: safeIso(ordered[0]?.timestamp ?? null),
      source: "user",
      message: requirement,
      extra: { kind: "alfred_requirement" },
    });
  }

  for (const e of ordered) {
    const { envelope, data } = unwrapEventEnvelope(e.eventData);
    const ts = envelope?.createdAt ?? safeIso(e.timestamp);
    const extra = {
      eventId: e.eventId,
      eventType: e.eventType,
      seq: e.seq ?? undefined,
    };

    if (e.eventType === "ui-message") {
      if (!isUiMessageArray(data)) {
        continue;
      }
      for (const m of data) {
        const { text, reasoning } = pullTextParts(m);
        const { toolCalls, obs } = pullToolParts(m);

        const message = text;

        const s: AtifStep = {
          step_id: stepId++,
          timestamp: ts,
          source: mapUiRoleToAtifSource(m.role),
          message,
          extra: {
            ...extra,
            uiMessageId: m.id,
          },
        };

        if (reasoning.length > 0) {
          s.reasoning_content = reasoning;
        }
        if (toolCalls.length > 0) {
          s.tool_calls = toolCalls;
        }
        if (obs.length > 0) {
          s.observation = { results: obs };
        }
        steps.push(s);
      }
      continue;
    }

    if (e.eventType === "tool-call") {
      const r = coerceRecord(data);
      const toolCallId = coerceString(r.toolCallId);
      const toolName = coerceString(r.toolName);
      if (toolCallId && toolName) {
        steps.push(
          toolCallStep({
            stepId: stepId++,
            ts,
            toolCallId,
            toolName,
            input: r.input,
            extra,
          })
        );
      }
      continue;
    }

    if (e.eventType === "tool-result") {
      const r = coerceRecord(data);
      const toolCallId = coerceString(r.toolCallId);
      const toolName = coerceString(r.toolName);
      if (toolCallId && toolName) {
        steps.push(
          toolResultStep({
            stepId: stepId++,
            ts,
            toolCallId,
            toolName,
            output: r.output,
            extra,
          })
        );
      }
      continue;
    }

    if (e.eventType === "stdout" || e.eventType === "stderr") {
      const r = coerceRecord(data);
      const text = coerceString(r.text) ?? "";
      steps.push({
        step_id: stepId++,
        timestamp: ts,
        source: "system",
        message: text,
        extra,
      });
      continue;
    }

    if (e.eventType === "assistant") {
      const r = coerceRecord(data);
      const text = coerceString(r.text) ?? "";
      steps.push({
        step_id: stepId++,
        timestamp: ts,
        source: "agent",
        message: text,
        extra,
      });
      continue;
    }

    if (e.eventType === "notice" || e.eventType === "error") {
      const r = coerceRecord(data);
      const msg = coerceString(r.message) ?? JSON.stringify(r);
      steps.push({
        step_id: stepId++,
        timestamp: ts,
        source: "system",
        message: msg,
        extra,
      });
    }
  }

  return {
    schema_version: schemaVersion,
    session_id: args.runId,
    agent: {
      name: agent.name,
      version: agent.version,
      model_name: agent.modelName,
    },
    steps,
    final_metrics: { total_steps: steps.length },
    extra: {
      kind: "alfred_workflow_export",
      workflowRunId: args.runId,
    },
  };
}
