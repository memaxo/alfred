import { isAgentFSWorkspace } from "@alfred/agent/environment/agentfs";
import { WorkspaceFactory } from "@alfred/agent/environment/factory";

export interface RunWorkspace {
  containerName: string;
  containerCw: string;
  agentfsDbPath: string;
  cleanup: () => Promise<void>;
}

export async function createWorkspace(args: {
  authz: string;
  image: string;
  retain: "never" | "on-fail" | "always";
  runId: string;
  cwd: string;
}): Promise<RunWorkspace> {
  const wsId = `evals-${args.runId}`;
  const ws = await WorkspaceFactory.create(
    "agentfs",
    wsId,
    args.runId,
    args.cwd,
    {
      authz: args.authz,
      image: args.image,
      retainContainer: args.retain !== "never",
    }
  );
  await ws.initialize();

  if (!isAgentFSWorkspace(ws)) {
    throw new Error("workspace_not_agentfs");
  }

  return {
    containerName: ws.containerName,
    containerCw: ws.containerCw,
    agentfsDbPath: ws.dbPath,
    cleanup: async () => {
      await ws.cleanup();
    },
  };
}
