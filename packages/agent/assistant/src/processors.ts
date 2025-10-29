import { MemoryProcessor, type MemoryProcessorOpts } from "@mastra/core/memory";

export class PreferenceMemoryProcessor extends MemoryProcessor {
  constructor() {
    super({ name: "PreferenceMemoryProcessor" });
  }

  process(messages: any[], _opts: MemoryProcessorOpts): any[] {
    return messages;
  }
}

export class ToolDigestMemoryProcessor extends MemoryProcessor {
  constructor() {
    super({ name: "ToolDigestMemoryProcessor" });
  }

  process(messages: any[], _opts: MemoryProcessorOpts): any[] {
    return messages;
  }
}
