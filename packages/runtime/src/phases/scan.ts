import type {
  ContextBundle,
  SearchReceipt,
  WorkflowEvent,
} from "@alfred/type/plan";

import {
  gatherCodeContext,
  gatherWebContext,
} from "@alfred/agent/orchestrator/flow/context";
import { logger } from "@alfred/logger";

import type { ExecutionContext } from "../context";
import type { RuntimeInput } from "../types";

import { ContextBuilder } from "../context";

function assertNotAborted(signal: AbortSignal): void {
  if (!signal.aborted) {
    return;
  }

  const { reason } = signal;
  if (reason instanceof Error) {
    throw reason;
  }

  throw new DOMException("Phase aborted", "AbortError");
}

function createWebReceipt(receipt: SearchReceipt): SearchReceipt {
  return {
    code: [],
    web: receipt.web,
    created: receipt.created,
    summary: receipt.summary,
  } satisfies SearchReceipt;
}

function emitBundleEvent(bundle: ContextBundle | null): WorkflowEvent | null {
  if (!bundle) {
    return null;
  }

  return {
    _: "context",
    phase: "bundle",
    bundle,
  } as WorkflowEvent;
}

function normalizeWriterChunk(chunk: unknown): WorkflowEvent | null {
  if (!chunk || typeof chunk !== "object") {
    return null;
  }
  const maybe = chunk as Record<string, unknown>;
  const kind =
    typeof maybe._ === "string"
      ? maybe._
      : (typeof maybe.type === "string"
        ? maybe.type
        : null);
  if (!kind) {
    return null;
  }
  return { ...maybe, _: kind } as WorkflowEvent;
}

function drainWriterEvents(queue: WorkflowEvent[]): WorkflowEvent[] {
  if (queue.length === 0) {
    return [];
  }
  return queue.splice(0);
}

export async function* executeScanPhase(
  input: RuntimeInput,
  runId: string,
  signal: AbortSignal,
  authz?: string,
  userId?: string
): AsyncGenerator<WorkflowEvent, ExecutionContext | null, void> {
  const contextEnabled = input.context?.enable ?? true;
  const workspace = input.workspace ?? process.cwd();
  const contextOptions = input.context ?? {};
  const builder = new ContextBuilder();
  const writerEvents: WorkflowEvent[] = [];
  const writer = {
    write: async (chunk: unknown) => {
      const event = normalizeWriterChunk(chunk);
      if (event) {
        writerEvents.push(event);
      }
    },
  };

  yield {
    _: "context",
    phase: "scan",
    message: "gathering_context",
  } as WorkflowEvent;

  assertNotAborted(signal);

  if (!contextEnabled) {
    logger.info("runtime_scan_context_skipped", {
      runId,
      reason: "disabled",
    });
    yield {
      _: "notice",
      message: "context_gathering_disabled",
    } as WorkflowEvent;
    return null;
  }

  try {
    const codeReceipt = await gatherCodeContext({
      requirement: input.requirement,
      cw: workspace,
      exts: contextOptions.exts,
      ignore: contextOptions.ignore,
      topK: contextOptions.topK,
      authz,
      writer,
      userId,
    });

    assertNotAborted(signal);
    for (const event of drainWriterEvents(writerEvents)) {
      yield event;
    }

    const webReceipt = contextOptions.web
      ? await gatherWebContext({
          requirement: input.requirement,
          authz,
          writer,
          topK: contextOptions.topK,
        })
      : null;

    assertNotAborted(signal);
    for (const event of drainWriterEvents(writerEvents)) {
      yield event;
    }

    const receipts: SearchReceipt = {
      code: codeReceipt.code,
      web: webReceipt?.web,
      created: new Date(),
      summary: [codeReceipt.summary, webReceipt?.summary]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 500),
    };

    const context = await builder.build(
      {
        requirement: input.requirement,
        workspace,
        repoBase: input.repoBase,
        web: contextOptions.web,
        topK: contextOptions.topK,
        maxTokens: contextOptions.maxTokens,
        exts: contextOptions.exts,
        ignore: contextOptions.ignore,
        seeds: contextOptions.seeds,
        authz,
        userId,
      },
      {
        receipts,
        writer,
      }
    );

    assertNotAborted(signal);
    for (const event of drainWriterEvents(writerEvents)) {
      yield event;
    }

    yield {
      _: "context",
      phase: "scan",
      message: "context_gathered",
      receipts: context.receipts,
    } as WorkflowEvent;

    if (context.receipts.web && context.receipts.web.length > 0) {
      yield {
        _: "context",
        phase: "web",
        message: "web_context_gathered",
        receipts: createWebReceipt(context.receipts),
      } as WorkflowEvent;
    }

    const bundleEvent = emitBundleEvent(context.bundle);
    if (bundleEvent) {
      yield bundleEvent;
    }

    logger.info("runtime_scan_context_completed", {
      runId,
      tokens: context.totalTokens,
      workspace,
      bundleFiles: context.bundle?.files.length ?? 0,
      ragChunks: context.ragChunks?.length ?? 0,
    });

    yield {
      _: "notice",
      message: "context_gathering_completed",
    } as WorkflowEvent;

    return context;
  } catch (error) {
    logger.error("runtime_scan_context_failed", {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });

    yield {
      _: "notice",
      message: "context_gathering_failed",
      error: error instanceof Error ? error.message : String(error),
    } as WorkflowEvent;

    throw error;
  }
}
