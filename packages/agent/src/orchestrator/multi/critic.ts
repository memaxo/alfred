import { toolCodex } from "../tool/codex";
// import type { RuntimeContext } from "@alfred/type/runtime-context";

export type CriticResult = {
  approved: boolean;
  feedback: string;
};

export async function executeCriticPhase(runId: string): Promise<CriticResult> {
  // Read the generated plans and architecture
  // For simplicity, we ask the critic to review the current workspace state
  // specifically looking for ARCHITECTURE.md and .agent/plans/*.md

  const prompt = [
    "You are a Senior Code Reviewer and Security Auditor.",
    "Review the ARCHITECTURE.md and any Execution Plans (.agent/plans/*.md) in the current directory.",
    "",
    "Critique the proposed solution.",
    "If the plan is solid, safe, and complete, output 'APPROVED'.",
    "If there are issues, output 'REJECTED' followed by a bulleted list of specific feedback.",
    "",
    "Issues to look for:",
    "- Security vulnerabilities (SQL injection, auth bypass)",
    "- Performance bottlenecks",
    "- Over-engineering or complexity",
    "- Missing tests or validation",
  ].join("\n");

  try {
    // Capture output from the critic
    let output = "";

    await toolCodex.execute({
      input: {
        action: "exec",
        prompt,
        out: "text",
        auto: "low", // Critic is read-only mostly, but might write a report
        cw: process.cwd(),
        sessionId: `critic-${runId}`,
        model: "claude-3-5-sonnet-20241022",
      },
      writer: {
        write: (chunk) => {
          const payload = chunk as any;
          if (payload.type === "stdout") {
            output += payload.text;
          }
        },
      },
    });

    const approved = output.includes("APPROVED");
    return {
      approved,
      feedback: output,
    };
  } catch (error) {
    return {
      approved: false,
      feedback: `Critic failed: ${error}`,
    };
  }
}

export function critic(_context: any): string[] {
  // Placeholder
  return [];
}
