import { toolOpenCode } from "@alfred/agent/orchestrator/tool/opencode/index";

export async function runOpenCodeOnce(args: {
  authz: string;
  containerName: string;
  containerCw: string;
  execProfile: "default" | "server";
  transport: "acp" | "http";
  prompt: string;
  model: string;
  timeoutSec: number;
  onNotice: (msg: string) => void;
  onStderr: (text: string) => void;
}): Promise<string> {
  const isHttp = args.transport === "http";
  const res = await toolOpenCode.execute({
    input: {
      action: "exec",
      transport: isHttp ? "http" : "acp",
      execProfile: args.execProfile,
      prompt: args.prompt,
      auto: "read",
      cw: process.cwd(),
      model: args.model,
      ...(isHttp
        ? {}
        : {
            cmd: "opencode",
            args: ["acp", "--hostname", "127.0.0.1", "--port", "47123"],
          }),
      containerName: args.containerName,
      containerCw: args.containerCw,
      authz: args.authz,
      timeoutSec: args.timeoutSec,
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
