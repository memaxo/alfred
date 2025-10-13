export type ResumePayload = {
  event: "deploy-authz" | "linear-authz";
  authz: string;
};

export interface RunHandle {
  resume(args: { resumeData: ResumePayload }): Promise<unknown>;
  cancel(): Promise<unknown>;
  abortController: AbortController;
}

export interface RunRegistry {
  register(runId: string, handle: RunHandle): void;
  unregister(runId: string): void;
  dispatchResume(runId: string, payload: ResumePayload): Promise<boolean>;
}

export class MemoryRunRegistry implements RunRegistry {
  private readonly runs = new Map<string, RunHandle>();

  register(runId: string, handle: RunHandle) {
    this.runs.set(runId, handle);
  }

  unregister(runId: string) {
    this.runs.delete(runId);
  }

  async dispatchResume(runId: string, payload: ResumePayload): Promise<boolean> {
    const handle = this.runs.get(runId);
    if (!handle) {
      return false;
    }
    await handle.resume({ resumeData: payload });
    return true;
  }
}
