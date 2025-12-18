import { logger } from "@alfred/logger";
import type {
  ThreadEvent,
  ThreadOptions,
  TurnOptions,
} from "@openai/codex-sdk";

type CodexConstructor = typeof import("@openai/codex-sdk").Codex;
type CodexModule = { Codex: CodexConstructor };

let cachedModule: CodexModule | null = null;
let loadPromise: Promise<CodexModule> | null = null;
let stubLogged = false;

export async function loadCodexSdk(): Promise<CodexModule> {
  if (cachedModule) {
    return cachedModule;
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      if (shouldForceStub()) {
        return createStubModule("forced");
      }

      try {
        const realModule = await import("@openai/codex-sdk");
        return realModule;
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : String(error ?? "unknown");
        return createStubModule(reason);
      }
    })();
  }

  cachedModule = await loadPromise;
  return cachedModule;
}

function shouldForceStub(): boolean {
  const flag = process.env.CODEX_SDK_STUB?.toLowerCase?.();
  return flag === "1" || flag === "true";
}

function createStubModule(reason: string): CodexModule {
  if (!stubLogged) {
    stubLogged = true;
    logger.warn("codex_sdk_stub_activated", { reason });
  }

  class StubThread {
    id: string;

    constructor(id: string) {
      this.id = id;
    }

    runStreamed(prompt: string, _options: TurnOptions) {
      const events: ThreadEvent[] = [
        { type: "thread.started", thread_id: this.id } as ThreadEvent,
        { type: "turn.started" } as ThreadEvent,
        {
          type: "item.completed",
          item: {
            id: `stub-${Date.now()}`,
            type: "agent_message",
            text: `codex_sdk_stub:${prompt.slice(0, 64)}`,
          },
        },
        {
          type: "turn.completed",
          usage: { input_tokens: 0, output_tokens: 0, cached_input_tokens: 0 },
        },
      ];

      return {
        events: (function* () {
          for (const event of events) {
            yield event;
          }
        })(),
      };
    }
  }

  class StubCodex {
    startThread(_options: ThreadOptions): StubThread {
      return new StubThread(createThreadId());
    }

    resumeThread(threadId: string, _options: TurnOptions): StubThread {
      return new StubThread(threadId || createThreadId());
    }

    validateThread(): Promise<boolean> {
      return Promise.resolve(true);
    }
  }

  return { Codex: StubCodex as unknown as CodexConstructor };
}

function createThreadId(): string {
  return `stub-thread-${Math.random().toString(36).slice(2, 10)}`;
}
