import { logger } from "@alfred/logger";
import type {
  ContextBundle,
  SearchReceipt,
  WorkflowEvent,
} from "@alfred/type/plan";
import { ContextBuilder } from "../context";
import type { ExecutionContext } from "../context";
import type { RuntimeInput } from "../types";

function assertNotAborted(signal: AbortSignal): void {
  if (!signal.aborted) {
    return;
  }

  const reason = signal.reason;
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
    type: "context",
    phase: "bundle",
    bundle,
  } as WorkflowEvent;
}

export async function* executeScanPhase(
  input: RuntimeInput,
  runId: string,
  signal: AbortSignal
): AsyncGenerator<WorkflowEvent, ExecutionContext | null, void> {
  const contextEnabled = input.context?.enable ?? true;
  const workspace = input.workspace ?? process.cwd();
  const contextOptions = input.context ?? {};
  const builder = new ContextBuilder();

  yield {
    type: "context",
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
      type: "notice",
      message: "context_gathering_disabled",
    } as WorkflowEvent;
    return null;
  }

  try {
    const context = await builder.build({
      requirement: input.requirement,
      workspace,
      repoBase: input.repoBase,
      web: contextOptions.web,
      topK: contextOptions.topK,
      maxTokens: contextOptions.maxTokens,
      exts: contextOptions.exts,
      ignore: contextOptions.ignore,
      seeds: contextOptions.seeds,
      authz: undefined,
    });

    assertNotAborted(signal);

    yield {
      type: "context",
      phase: "scan",
      message: "context_gathered",
      receipts: context.receipts,
    } as WorkflowEvent;

    if (context.receipts.web && context.receipts.web.length > 0) {
      yield {
        type: "context",
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
      type: "notice",
      message: "context_gathering_completed",
    } as WorkflowEvent;

    return context;
  } catch (error) {
    logger.error("runtime_scan_context_failed", {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });

    yield {
      type: "notice",
      message: "context_gathering_failed",
      error: error instanceof Error ? error.message : String(error),
    } as WorkflowEvent;

    throw error;
  }
}
