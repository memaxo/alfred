import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readEscalationFile } from "../../src/stages/execute";

describe("Escalation Flow", () => {
  const testWorkspace = join(
    process.cwd(),
    ".agent/test-workspaces/pipeline-escalation-test"
  );
  const agentId = "test-agent";

  beforeAll(async () => {
    await mkdir(testWorkspace, { recursive: true });
  });

  afterAll(async () => {
    await rm(testWorkspace, { recursive: true, force: true });
  });

  it("returns null when escalation file is missing", async () => {
    const result = await readEscalationFile(testWorkspace, agentId);
    expect(result).toBeNull();
  });

  it("reads and trims escalation file contents", async () => {
    const escalationContent = `# Escalation Request

## Reason
Need human review for security-sensitive changes.
`;
    const filePath = join(testWorkspace, `ESCALATION-${agentId}.md`);
    await writeFile(filePath, `\n${escalationContent}\n`);

    const result = await readEscalationFile(testWorkspace, agentId);
    expect(result).toBe(escalationContent.trim());
  });

  it("returns null when escalation file is empty", async () => {
    const filePath = join(testWorkspace, `ESCALATION-${agentId}.md`);
    await writeFile(filePath, "   ");

    const result = await readEscalationFile(testWorkspace, agentId);
    expect(result).toBeNull();
  });
});
