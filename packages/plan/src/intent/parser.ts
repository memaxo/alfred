import { randomUUID } from "node:crypto";
import { getModelId, getOpenAI } from "../ai.js";
import { generateObject } from "ai";
import { intentParserOutputSchema } from "./schema.js";
import type {
  ClarificationQuestion,
  Pattern,
  WorkflowIntent,
} from "./types.js";

/**
 * parseIntent: Parse natural language input into structured WorkflowIntent objects
 */
export async function parseIntent(
  input: string,
  context: {
    userId: string;
    source?: "voice" | "chat" | "api";
    workspace?: string;
    codebase?: string;
    existingPatterns?: Pattern[];
  },
  _options: {
    maxClarifications?: number;
    autoResolve?: boolean;
  } = {}
): Promise<
  | { type: "intent"; intent: WorkflowIntent }
  | { type: "clarification"; questions: ClarificationQuestion[] }
  | { type: "multiIntent"; intents: WorkflowIntent[] }
> {
  const model = getOpenAI()(getModelId());
  
  const result = await generateObject({
    // biome-ignore lint/suspicious/noExplicitAny: AI SDK version mismatch across monorepo packages requires cast
    model: model as any,
    schema: intentParserOutputSchema,
    prompt: `
      You are ALFRED's intent parser. Your job is to analyze user input and transform it into a structured intent for workflow planning.
      
      User Input: "${input}"
      
      Context:
      - Workspace: ${context.workspace ?? "Unknown"}
      - User ID: ${context.userId}
      
      Instructions:
      1. Analyze the user's input for clarity and completeness.
      2. If the input is ambiguous (e.g., uses "it", "that", or lacks specific context), provide an ambiguity score and clarification questions.
      3. If the input contains multiple distinct requests (e.g., "Add a feature and fix a bug"), set multiIntent.split to true and provide the individual parts.
      4. Provide a concise, professional description of the intent.
      
      Ambiguity Examples:
      - "Fix the bug" -> Highly ambiguous (which bug? where?)
      - "Add dark mode" -> Clear (standard UI feature)
      - "Update the file" -> Ambiguous (which file?)
      
      Multi-Intent Examples:
      - "Create a new router and update the schema" -> Two intents
      - "Refactor the auth module and add tests" -> Two intents
    `,
  });

  const output = result.object;
  // console.log("DEBUG: output", JSON.stringify(output, null, 2));

  // Handle Multi-Intent
  if (output.multiIntent.split && output.multiIntent.parts.length > 1) {
    const intents = output.multiIntent.parts.map((part) =>
      createIntentObject(part, context)
    );
    return { type: "multiIntent", intents };
  }

  // Handle Ambiguity
  if (output.ambiguity.score > 0.7 && output.ambiguity.questions.length > 0) {
    const questions: ClarificationQuestion[] = output.ambiguity.questions.map(
      (q) => ({
        id: randomUUID(),
        question: q.question,
        options: q.options,
        required: true,
      })
    );
    return { type: "clarification", questions };
  }

  // Single Intent
  const intent = createIntentObject(output.description, context);

  // Attach ambiguity if it's below the threshold but still noteworthy
  if (output.ambiguity.score > 0) {
    intent.ambiguity = {
      score: output.ambiguity.score,
      questions: output.ambiguity.questions.map((q) => ({
        id: randomUUID(),
        question: q.question,
        options: q.options,
        required: true,
      })),
    };
  }

  return { type: "intent", intent };
}

function createIntentObject(
  description: string,
  context: {
    userId: string;
    source?: "voice" | "chat" | "api";
    workspace?: string;
    codebase?: string;
    existingPatterns?: Pattern[];
  }
): WorkflowIntent {
  return {
    id: randomUUID(),
    description,
    source: context.source ?? "chat",
    userId: context.userId,
    timestamp: new Date(),
    context: {
      workspace: context.workspace,
      codebase: context.codebase,
      existingPatterns: context.existingPatterns ?? [],
      constraints: [],
    },
  };
}
