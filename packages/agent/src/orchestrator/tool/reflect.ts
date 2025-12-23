import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { z } from "zod";
import type { ToolExecuteArgs } from "./shared/context.js";

const reflectInputSchema = z.object({
  authz: z.string().optional(),
  taskId: z.string().optional(),
  outcome: z.enum(["success", "failure"]),
  learnings: z.array(z.string()).min(1),
  domain: z.string().optional(), // e.g., "database", "testing", "voice"
});

type ReflectInput = z.infer<typeof reflectInputSchema>;

async function enforcePolicy(input: ReflectInput) {
  // Reflection is a low-risk operation that only affects docs.
  // We require a "reflect.write" scope, but typically this would be granted
  // to autonomous agents by default or via role.
  await requireToolScopesAndPolicy(input.authz, ["reflect.write"], {
    action: "reflect.codify",
    resource: {
      kind: "ruler",
      id: input.domain ?? "general",
    },
  });
}

const DOMAIN_MAP: Record<string, string> = {
  database: "04-database.md",
  db: "04-database.md",
  testing: "05-testing.md",
  test: "05-testing.md",
  observability: "18-observability.md",
  metrics: "18-observability.md",
  voice: "25-voice-architecture.md",
  ui: "12-component-development.md",
  react: "12-component-development.md",
  design: "26-design-system.md",
};

function getTargetFile(domain?: string): string {
  const rulerDir = resolve(process.cwd(), ".ruler");
  let filename = "99-learned.md";

  if (domain) {
    const lower = domain.toLowerCase();
    if (DOMAIN_MAP[lower]) {
      filename = DOMAIN_MAP[lower];
    } else {
      // Try to find a matching file by prefix or keyword if needed,
      // but for now default to 99-learned if no explicit map.
    }
  }

  return join(rulerDir, filename);
}

async function appendRule(filePath: string, rules: string[]) {
  let content = "";
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    content = "# Learned Rules\n\n";
  }

  // Simple append for MVP.
  // In a real implementation, we might want to parse the markdown
  // and insert logically, or use an LLM to merge.
  const newContent = rules.map((r) => `- ${r}`).join("\n");

  // Ensure we don't duplicate exactly
  if (!content.includes(newContent)) {
    // Add a header if it's a fresh section
    if (!content.includes("## Learned Rules")) {
      content += "\n\n## Learned Rules\n";
    }
    content += `\n${newContent}`;
    await writeFile(filePath, content, "utf-8");
    return true;
  }

  return false;
}

export const toolReflect = {
  name: "reflect",
  description:
    "Reflect on task execution and codify learnings into the project rulebook.",
  inputSchema: reflectInputSchema,
  outputSchema: z.object({
    success: z.boolean(),
    fileUpdated: z.string().optional(),
    message: z.string(),
  }),
  execute: async ({ input }: ToolExecuteArgs<ReflectInput>) => {
    await enforcePolicy(input);

    const targetFile = await getTargetFile(input.domain);
    const updated = await appendRule(targetFile, input.learnings);

    if (updated) {
      return {
        success: true,
        fileUpdated: targetFile,
        message:
          "Learnings codified. Run `bun run ruler:apply` to regenerate AGENTS.md and editor rules.",
      };
    }

    return {
      success: true,
      message: "Learnings were already present or empty.",
    };
  },
};

export type ToolReflect = typeof toolReflect;
