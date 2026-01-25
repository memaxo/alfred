import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";

export async function runCodexOnce(args: {
  authz: string;
  containerName: string;
  containerCw: string;
  agentfsDbPath: string;
  execProfile: "default" | "server";
  prompt: string;
  onNotice: (msg: string) => void;
  onStderr: (text: string) => void;
}): Promise<string> {
  const res = await toolCodex.execute({
    input: {
      action: "exec",
      execProfile: args.execProfile,
      prompt: args.prompt,
      out: "text",
      auto: "read",
      cw: process.cwd(),
      agentfsDbPath: args.agentfsDbPath,
      containerName: args.containerName,
      containerCw: args.containerCw,
      authz: args.authz,
    },
    writer: {
      write: (chunk) => {
        if (!chunk || typeof chunk !== "object") {
          return;
        }
        const c = chunk as {
          type?: unknown;
          text?: unknown;
          message?: unknown;
        };
        if (c.type === "stderr" && typeof c.text === "string") {
          args.onStderr(c.text);
        }
        if (c.type === "notice" && typeof c.message === "string") {
          args.onNotice(c.message);
        }
      },
    },
  });
  return res.result;
}
