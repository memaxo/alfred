export type WebAgentfsDb = {
  kv: {
    get<T = unknown>(key: string): Promise<T | undefined>;
  };
  fs: {
    stat(path: string): Promise<{ isDirectory(): boolean }>;
    readFile(
      path: string,
      opts?: unknown
    ): Promise<string | Uint8Array | Buffer>;
  };
  close(): Promise<void>;
};

function safeRunId(runId: string): string {
  return runId.replace(/[^a-zA-Z0-9-]/g, "-");
}

export async function openAgentfsDb(args: {
  runId: string;
  dbPath: string;
}): Promise<{ fsdb: WebAgentfsDb; baseDir: string | null }> {
  const agentfsPkg = "@alfred/agent/agentfs";
  const { AlfredAgentFS } = await import(/* @vite-ignore */ agentfsPkg);

  const id = `web-${safeRunId(args.runId)}`.slice(0, 64);
  const fsdb = (await AlfredAgentFS.open(
    { id, path: args.dbPath },
    args.runId
  )) as unknown as WebAgentfsDb;

  try {
    const baseDir =
      (await fsdb.kv.get<string>("baseDir").catch(() => null)) ?? null;
    if (baseDir) {
      await fsdb.close();
      const reopened = (await AlfredAgentFS.open(
        { id, path: args.dbPath, base: baseDir },
        args.runId
      )) as unknown as WebAgentfsDb;
      return { fsdb: reopened, baseDir };
    }
    return { fsdb, baseDir: null };
  } catch {
    return { fsdb, baseDir: null };
  }
}

export function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}
