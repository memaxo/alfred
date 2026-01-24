import type { WorkflowEvent } from "@alfred/type/plan";
import type { ModelMessage, Tool } from "ai";

import { safeValidateTypes } from "@ai-sdk/provider-utils";
import { z } from "zod";

import {
  runtimeToolGraphNodeDurationSeconds,
  runtimeToolGraphNodesTotal,
} from "./metrics";

const refSpecSchema = z
  .object({
    step: z.string().min(1),
    path: z.string().min(1).optional(),
  })
  .strict();

const toolRefSchema = z
  .object({
    $ref: refSpecSchema,
  })
  .strict();

type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
type JsonObject = { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    toolRefSchema as unknown as z.ZodType<JsonValue>,
    z.array(jsonValueSchema),
    z.unknown().superRefine((value, ctx) => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Expected object",
        });
        return;
      }
      if ("$ref" in value && !toolRefSchema.safeParse(value).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid $ref object shape",
        });
        return;
      }
    }) as unknown as z.ZodType<JsonObject>,
  ])
);

const fallbackSchema = z
  .object({
    toolName: z.string().min(1),
    input: jsonValueSchema,
  })
  .strict();

const TOOL_GRAPH_MAX_NODES = 32;

const nodeSchema = z
  .object({
    id: z.string().min(1),
    toolName: z.string().min(1),
    input: jsonValueSchema,
    dependsOn: z.array(z.string().min(1)).optional(),
    retries: z.number().int().min(0).max(3).optional(),
    fallback: fallbackSchema.optional(),
  })
  .strict();

export const toolGraphSchema = z
  .object({
    nodes: z.array(nodeSchema).min(1).max(TOOL_GRAPH_MAX_NODES),
  })
  .strict();

export type ToolGraph = z.infer<typeof toolGraphSchema>;
export type ToolNode = z.infer<typeof nodeSchema>;
type ToolRef = z.infer<typeof toolRefSchema>;

type ToolDef = Tool<unknown, unknown>;

export type ToolNodeResult =
  | {
      id: string;
      status: "succeeded";
      toolName: string;
      attempts: number;
      usedFallback: boolean;
      output: unknown;
    }
  | {
      id: string;
      status: "failed";
      toolName: string;
      attempts: number;
      usedFallback: boolean;
      error: string;
    };

export type ToolGraphResult = {
  status: "succeeded" | "failed";
  nodes: Record<string, ToolNodeResult>;
  outputs: Record<string, unknown>;
};

export type ExecuteToolGraphOptions = {
  graph: ToolGraph;
  tools: Record<string, ToolDef>;
  signal?: AbortSignal;
  toolCallMessages?: ModelMessage[];
  backoffMs?: number;
  maxParallel?: number;
  makeToolCallId?: () => string;
};

type PreparedGraph = {
  nodesById: Map<string, ToolNode>;
  order: string[];
  depsById: Map<string, string[]>;
};

type ToolAttemptResult =
  | { ok: true; output: unknown }
  | { ok: false; error: string };

type NodeExecution = {
  events: WorkflowEvent[];
  result: ToolNodeResult;
};

export async function* executeToolGraph(
  options: ExecuteToolGraphOptions
): AsyncGenerator<WorkflowEvent, ToolGraphResult, void> {
  const makeToolCallId = options.makeToolCallId ?? defaultToolCallId;
  const backoffMs = clampInt(options.backoffMs ?? 25, 0, 10_000);
  const maxParallel = clampInt(options.maxParallel ?? 4, 1, 32);
  const toolCallMessages = options.toolCallMessages ?? [];

  assertNotAborted(options.signal);
  assertGraphSizeWithinLimit(options.graph, TOOL_GRAPH_MAX_NODES);

  const prepared = prepareGraph(options.graph, options.tools);
  const outputs = new Map<string, unknown>();
  const nodeResults = new Map<string, ToolNodeResult>();

  const pending = new Set(prepared.order);
  while (pending.size > 0) {
    assertNotAborted(options.signal);

    const ready = getReadyNodes(prepared, pending, nodeResults);
    if (ready.length === 0) {
      break;
    }

    const batch = ready.slice(0, maxParallel);
    const settled = await Promise.allSettled(
      batch.map((nodeId) =>
        runNode({
          nodeId,
          prepared,
          outputs,
          tools: options.tools,
          signal: options.signal,
          toolCallMessages,
          backoffMs,
          makeToolCallId,
        })
      )
    );

    for (let i = 0; i < batch.length; i += 1) {
      const nodeId = batch[i];
      if (!nodeId) {
        continue;
      }
      pending.delete(nodeId);

      const entry = settled[i] as
        | PromiseSettledResult<NodeExecution>
        | undefined;
      if (entry?.status === "fulfilled") {
        for (const event of entry.value.events) {
          yield event;
        }

        nodeResults.set(nodeId, entry.value.result);
        if (entry.value.result.status === "succeeded") {
          outputs.set(nodeId, entry.value.result.output);
        }
        continue;
      }

      const node = prepared.nodesById.get(nodeId);
      const toolName = node?.toolName ?? "unknown";
      const errorText =
        entry && "reason" in entry
          ? errorMessage(entry.reason)
          : "unknown_node_failure";

      yield {
        _: "error",
        message: "tool_node_crashed",
        chunk: { nodeId, toolName, error: errorText },
      } satisfies WorkflowEvent;

      nodeResults.set(nodeId, {
        id: nodeId,
        status: "failed",
        toolName,
        attempts: 1,
        usedFallback: false,
        error: errorText,
      });
    }
  }

  if (pending.size > 0) {
    for (const nodeId of prepared.order) {
      if (!pending.has(nodeId)) {
        continue;
      }
      const blocked = prepared.nodesById.get(nodeId);
      const toolName = blocked?.toolName ?? "unknown";
      const deps = prepared.depsById.get(nodeId) ?? [];
      const failedDeps = deps.filter(
        (dep) => nodeResults.get(dep)?.status !== "succeeded"
      );
      const error = `dependency_failed:${failedDeps.join(",") || "unknown"}`;

      yield {
        _: "error",
        message: "tool_node_blocked",
        chunk: { nodeId, toolName, error },
      } satisfies WorkflowEvent;

      nodeResults.set(nodeId, {
        id: nodeId,
        status: "failed",
        toolName,
        attempts: 0,
        usedFallback: false,
        error,
      });
    }
  }

  const nodeResultRecord = Object.fromEntries(nodeResults.entries());
  const outputRecord = Object.fromEntries(outputs.entries());
  const status = Object.values(nodeResultRecord).some(
    (r) => r.status === "failed"
  )
    ? "failed"
    : "succeeded";

  return {
    status,
    nodes: nodeResultRecord,
    outputs: outputRecord,
  };
}

function assertGraphSizeWithinLimit(graph: ToolGraph, maxNodes: number) {
  if (graph.nodes.length <= maxNodes) {
    return;
  }
  throw new Error(
    `tool_graph_too_many_nodes:${graph.nodes.length}:${maxNodes}`
  );
}

function prepareGraph(
  graph: ToolGraph,
  tools: Record<string, ToolDef>
): PreparedGraph {
  const nodesById = new Map<string, ToolNode>();
  const order: string[] = [];

  for (const node of graph.nodes) {
    if (nodesById.has(node.id)) {
      throw new Error(`tool_graph_duplicate_node_id:${node.id}`);
    }
    nodesById.set(node.id, node);
    order.push(node.id);
  }

  const depsById = new Map<string, string[]>();
  for (const node of graph.nodes) {
    const explicit = node.dependsOn ?? [];
    const implicit = Array.from(collectRefSteps(node.input));
    const fallbackImplicit = node.fallback
      ? Array.from(collectRefSteps(node.fallback.input))
      : [];

    const deps = stableUnique([...explicit, ...implicit, ...fallbackImplicit]);
    depsById.set(node.id, deps);
  }

  for (const [id, deps] of depsById.entries()) {
    for (const dep of deps) {
      if (!nodesById.has(dep)) {
        throw new Error(`tool_graph_missing_dependency:${id}:${dep}`);
      }
    }
  }

  assertToolNamesExist(graph, tools);
  assertDag(order, depsById);

  return { nodesById, order, depsById };
}

function assertToolNamesExist(
  graph: ToolGraph,
  tools: Record<string, ToolDef>
) {
  for (const node of graph.nodes) {
    if (!tools[node.toolName]) {
      throw new Error(`tool_graph_unknown_tool:${node.id}:${node.toolName}`);
    }
    if (node.fallback && !tools[node.fallback.toolName]) {
      throw new Error(
        `tool_graph_unknown_fallback_tool:${node.id}:${node.fallback.toolName}`
      );
    }
  }
}

function assertDag(order: string[], depsById: Map<string, string[]>) {
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const id of order) {
    indegree.set(id, 0);
    outgoing.set(id, []);
  }

  for (const [id, deps] of depsById.entries()) {
    for (const dep of deps) {
      outgoing.get(dep)?.push(id);
      indegree.set(id, (indegree.get(id) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const id of order) {
    if ((indegree.get(id) ?? 0) === 0) {
      queue.push(id);
    }
  }

  let visited = 0;
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) {
      break;
    }
    visited += 1;
    for (const next of outgoing.get(id) ?? []) {
      const nextDegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextDegree);
      if (nextDegree === 0) {
        queue.push(next);
      }
    }
  }

  if (visited !== order.length) {
    throw new Error("tool_graph_cycle_detected");
  }
}

function getReadyNodes(
  prepared: PreparedGraph,
  pending: Set<string>,
  results: Map<string, ToolNodeResult>
): string[] {
  const ready: string[] = [];
  for (const nodeId of prepared.order) {
    if (!pending.has(nodeId)) {
      continue;
    }
    const deps = prepared.depsById.get(nodeId) ?? [];
    const allDone = deps.every(
      (dep) => results.get(dep)?.status === "succeeded"
    );
    if (allDone) {
      ready.push(nodeId);
    }
  }
  return ready;
}

type RunNodeOptions = {
  nodeId: string;
  prepared: PreparedGraph;
  outputs: Map<string, unknown>;
  tools: Record<string, ToolDef>;
  signal?: AbortSignal;
  toolCallMessages: ModelMessage[];
  backoffMs: number;
  makeToolCallId: () => string;
};

async function runNode(options: RunNodeOptions): Promise<NodeExecution> {
  const node = options.prepared.nodesById.get(options.nodeId);
  if (!node) {
    throw new Error(`tool_graph_missing_node:${options.nodeId}`);
  }

  const events: WorkflowEvent[] = [];
  const stopTimer = runtimeToolGraphNodeDurationSeconds.startTimer();
  const finish = (result: ToolNodeResult): NodeExecution => {
    runtimeToolGraphNodesTotal.inc({
      tool: result.toolName,
      status: result.status,
    });
    stopTimer({ tool: result.toolName, status: result.status });
    return { events, result };
  };

  const maxRetries = clampInt(node.retries ?? 0, 0, 3);
  const maxAttempts = maxRetries + 1;

  let attempts = 0;
  let lastError = "unknown_tool_failure";

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    attempts += 1;
    assertNotAborted(options.signal);

    if (attempt > 0) {
      await sleepWithSignal(options.backoffMs * attempt, options.signal);
    }

    const attemptResult = await attemptTool({
      nodeId: node.id,
      toolName: node.toolName,
      input: node.input,
      outputs: options.outputs,
      tools: options.tools,
      signal: options.signal,
      toolCallMessages: options.toolCallMessages,
      makeToolCallId: options.makeToolCallId,
    });

    events.push(...attemptResult.events);

    if (attemptResult.result.ok) {
      return finish({
        id: node.id,
        status: "succeeded",
        toolName: node.toolName,
        attempts,
        usedFallback: false,
        output: attemptResult.result.output,
      });
    }

    lastError = attemptResult.result.error;
  }

  if (node.fallback) {
    assertNotAborted(options.signal);
    const fb = node.fallback;
    const attemptResult = await attemptTool({
      nodeId: node.id,
      toolName: fb.toolName,
      input: fb.input,
      outputs: options.outputs,
      tools: options.tools,
      signal: options.signal,
      toolCallMessages: options.toolCallMessages,
      makeToolCallId: options.makeToolCallId,
    });

    events.push(...attemptResult.events);

    if (attemptResult.result.ok) {
      return finish({
        id: node.id,
        status: "succeeded",
        toolName: fb.toolName,
        attempts,
        usedFallback: true,
        output: attemptResult.result.output,
      });
    }

    lastError = `fallback_failed:${attemptResult.result.error}`;
  }

  return finish({
    id: node.id,
    status: "failed",
    toolName: node.toolName,
    attempts,
    usedFallback: Boolean(node.fallback),
    error: lastError,
  });
}

type AttemptToolOptions = {
  nodeId: string;
  toolName: string;
  input: unknown;
  outputs: Map<string, unknown>;
  tools: Record<string, ToolDef>;
  signal?: AbortSignal;
  toolCallMessages: ModelMessage[];
  makeToolCallId: () => string;
};

async function attemptTool(options: AttemptToolOptions): Promise<{
  events: WorkflowEvent[];
  result: ToolAttemptResult;
}> {
  assertNotAborted(options.signal);

  const tool = options.tools[options.toolName];
  if (!tool) {
    return {
      events: [
        {
          _: "error",
          message: "tool_missing",
          chunk: { nodeId: options.nodeId, toolName: options.toolName },
        } satisfies WorkflowEvent,
      ],
      result: { ok: false, error: "tool_missing" },
    };
  }

  const toolCallId = options.makeToolCallId();
  const events: WorkflowEvent[] = [];

  let resolvedInput: unknown;
  try {
    resolvedInput = resolveRefs(options.input, options.outputs);
  } catch (error) {
    const message = errorMessage(error);
    events.push({
      _: "error",
      message: "tool_input_ref_failed",
      chunk: { nodeId: options.nodeId, toolName: options.toolName, message },
    } satisfies WorkflowEvent);
    events.push({
      _: "tool-call",
      toolCallId,
      toolName: options.toolName,
      input: options.input,
    } satisfies WorkflowEvent);
    events.push({
      _: "tool-result",
      toolCallId,
      toolName: options.toolName,
      input: options.input,
      output: { error: "tool_input_ref_failed", message },
    } satisfies WorkflowEvent);
    return { events, result: { ok: false, error: "tool_input_ref_failed" } };
  }

  events.push({
    _: "tool-call",
    toolCallId,
    toolName: options.toolName,
    input: resolvedInput,
  } satisfies WorkflowEvent);

  const validatedInput = await validateAgainstSchema({
    schema: tool.inputSchema,
    value: resolvedInput,
  });

  if (!validatedInput.ok) {
    events.push({
      _: "tool-result",
      toolCallId,
      toolName: options.toolName,
      input: resolvedInput,
      output: { error: "tool_input_invalid", detail: validatedInput.error },
    } satisfies WorkflowEvent);
    events.push({
      _: "error",
      message: "tool_input_invalid",
      chunk: {
        nodeId: options.nodeId,
        toolName: options.toolName,
        toolCallId,
        error: validatedInput.error,
      },
    } satisfies WorkflowEvent);
    return { events, result: { ok: false, error: "tool_input_invalid" } };
  }

  if (!tool.execute) {
    events.push({
      _: "tool-result",
      toolCallId,
      toolName: options.toolName,
      input: resolvedInput,
      output: { error: "tool_execute_missing" },
    } satisfies WorkflowEvent);
    return { events, result: { ok: false, error: "tool_execute_missing" } };
  }

  let output: unknown;
  try {
    output = await readToolOutput(
      tool.execute(validatedInput.value, {
        toolCallId,
        messages: options.toolCallMessages,
        abortSignal: options.signal,
      })
    );
  } catch (error) {
    const message = errorMessage(error);
    events.push({
      _: "tool-result",
      toolCallId,
      toolName: options.toolName,
      input: resolvedInput,
      output: { error: "tool_execute_failed", message },
    } satisfies WorkflowEvent);
    events.push({
      _: "error",
      message: "tool_execute_failed",
      chunk: {
        nodeId: options.nodeId,
        toolName: options.toolName,
        toolCallId,
        error: message,
      },
    } satisfies WorkflowEvent);
    return { events, result: { ok: false, error: "tool_execute_failed" } };
  }

  const validatedOutput = await validateAgainstSchema({
    schema: tool.outputSchema,
    value: output,
  });

  if (!validatedOutput.ok) {
    events.push({
      _: "tool-result",
      toolCallId,
      toolName: options.toolName,
      input: resolvedInput,
      output,
    } satisfies WorkflowEvent);
    events.push({
      _: "error",
      message: "tool_output_invalid",
      chunk: {
        nodeId: options.nodeId,
        toolName: options.toolName,
        toolCallId,
        error: validatedOutput.error,
      },
    } satisfies WorkflowEvent);
    return { events, result: { ok: false, error: "tool_output_invalid" } };
  }

  events.push({
    _: "tool-result",
    toolCallId,
    toolName: options.toolName,
    input: resolvedInput,
    output: validatedOutput.value,
  } satisfies WorkflowEvent);

  return { events, result: { ok: true, output: validatedOutput.value } };
}

async function validateAgainstSchema(options: {
  schema: ToolDef["inputSchema"] | ToolDef["outputSchema"] | undefined;
  value: unknown;
}): Promise<
  { ok: true; value: unknown } | { ok: false; error: string; rawValue: unknown }
> {
  if (!options.schema) {
    return { ok: true, value: options.value };
  }

  const validated = await safeValidateTypes({
    value: options.value,
    schema: options.schema as unknown as Parameters<
      typeof safeValidateTypes
    >[0]["schema"],
  });
  if (validated.success) {
    return { ok: true, value: validated.value };
  }

  return {
    ok: false,
    error: validated.error.message,
    rawValue: validated.rawValue,
  };
}

function resolveRefs(value: unknown, outputs: Map<string, unknown>): unknown {
  if (isRef(value)) {
    return readRef(value.$ref, outputs);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => resolveRefs(entry, outputs));
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = resolveRefs(v, outputs);
    }
    return out;
  }

  return value;
}

function readRef(ref: ToolRef["$ref"], outputs: Map<string, unknown>): unknown {
  if (!outputs.has(ref.step)) {
    throw new Error(`tool_ref_missing_step:${ref.step}`);
  }

  const base = outputs.get(ref.step);
  if (!ref.path) {
    return base;
  }

  const parts = parsePath(ref.path);
  const value = readPathValue(base, parts);
  if (value === undefined) {
    throw new Error(`tool_ref_missing_path:${ref.step}:${ref.path}`);
  }
  return value;
}

function readPathValue(value: unknown, parts: Array<string | number>): unknown {
  let current: unknown = value;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return;
    }

    if (typeof part === "number") {
      if (!Array.isArray(current)) {
        return;
      }
      current = current[part];
      continue;
    }

    if (typeof current !== "object") {
      return;
    }

    const record = current as Record<string, unknown>;
    current = record[part];
  }
  return current;
}

function parsePath(path: string): Array<string | number> {
  const out: Array<string | number> = [];
  let i = 0;

  while (i < path.length) {
    const ch = path[i];
    if (ch === ".") {
      i += 1;
      continue;
    }

    if (ch === "[") {
      const end = path.indexOf("]", i + 1);
      if (end === -1) {
        throw new Error(`tool_ref_invalid_path:${path}`);
      }
      const content = path.slice(i + 1, end).trim();
      if (!/^[0-9]+$/.test(content)) {
        throw new Error(`tool_ref_invalid_index:${path}`);
      }
      out.push(Number.parseInt(content, 10));
      i = end + 1;
      continue;
    }

    let end = i;
    while (end < path.length && path[end] !== "." && path[end] !== "[") {
      end += 1;
    }
    const key = path.slice(i, end);
    if (key.length === 0) {
      throw new Error(`tool_ref_invalid_path:${path}`);
    }
    out.push(key);
    i = end;
  }

  return out;
}

function collectRefSteps(value: unknown): Set<string> {
  const out = new Set<string>();
  walkForRefs(value, out);
  return out;
}

function walkForRefs(value: unknown, out: Set<string>) {
  if (isRef(value)) {
    out.add(value.$ref.step);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      walkForRefs(entry, out);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      walkForRefs(v, out);
    }
  }
}

function isRef(value: unknown): value is ToolRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const ref = record.$ref;
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) {
    return false;
  }
  const step = (ref as Record<string, unknown>).step;
  const path = (ref as Record<string, unknown>).path;
  if (typeof step !== "string" || step.length === 0) {
    return false;
  }
  if (path !== undefined && (typeof path !== "string" || path.length === 0)) {
    return false;
  }
  return Object.keys(record).length === 1;
}

async function readToolOutput(result: unknown): Promise<unknown> {
  if (isAsyncIterable(result)) {
    let last: unknown;
    for await (const chunk of result) {
      last = chunk;
    }
    return last as unknown;
  }
  return await Promise.resolve(result);
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }
  return Symbol.asyncIterator in value;
}

function stableUnique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  const rounded = Math.trunc(value);
  if (rounded < min) {
    return min;
  }
  if (rounded > max) {
    return max;
  }
  return rounded;
}

function defaultToolCallId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown_error";
}

function assertNotAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new DOMException("Phase aborted", "AbortError");
  }
}

function sleepWithSignal(ms: number, signal: AbortSignal | undefined) {
  if (ms <= 0) {
    return Promise.resolve();
  }
  if (!signal) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  if (signal.aborted) {
    return Promise.reject(new DOMException("Phase aborted", "AbortError"));
  }

  return new Promise<void>((resolve, reject) => {
    const handleAbort = () => {
      clearTimeout(timeout);
      reject(new DOMException("Phase aborted", "AbortError"));
    };

    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);

    signal.addEventListener("abort", handleAbort, { once: true });
  });
}
