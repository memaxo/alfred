import {
  analyzeContext,
  getPersonaInstruction,
} from "@alfred/agent/assistant/src/adapter";
import { KnowledgeEngine } from "@alfred/runtime/engines/knowledge";

type MemoryOptions = {
  semanticRecall?: {
    topK?: number;
    messageRange?:
      | number
      | {
          before?: number;
          after?: number;
        };
  };
};

type BuildAssistantContextOptions = {
  messages: unknown[];
  memory?: MemoryOptions;
  baseInstructions: string;
};

type BuildAssistantContextResult = {
  systemInstruction: string;
  detectedDomains: string[];
};

function getLastUserQuery(messages: unknown[]): string {
  const lastMessage = messages.at(-1) as {
    role?: string;
    content?: string;
  } | null;
  return lastMessage?.role === "user" ? String(lastMessage.content ?? "") : "";
}

export async function buildAssistantContext(
  options: BuildAssistantContextOptions
): Promise<BuildAssistantContextResult> {
  const { messages, memory, baseInstructions } = options;
  const query = getLastUserQuery(messages);

  let systemInstruction = baseInstructions;
  let detectedDomains: string[] = [];

  if (!query) {
    return { systemInstruction, detectedDomains };
  }

  const analysis = await analyzeContext(
    messages as Array<{ role: string; content: string }>
  );
  detectedDomains = analysis.domains;

  const persona = getPersonaInstruction(detectedDomains);
  if (persona) {
    systemInstruction += `\n\n${persona}`;
  }

  const recallOpts = memory?.semanticRecall;
  if (recallOpts) {
    const engine = new KnowledgeEngine();
    const chunks = await engine.retrieveContext(query, {
      topK: recallOpts.topK ?? 5,
      boostConcepts: detectedDomains,
      useHybrid: true,
    });

    if (chunks.length > 0) {
      const ragContext = `
<context_documents>
${chunks.map((c) => `<document>\n${c.content}\n</document>`).join("\n")}
</context_documents>
Use the above context to answer the user's question if relevant.
`;
      systemInstruction += `\n\n${ragContext}`;
    }
  }

  return { systemInstruction, detectedDomains };
}
