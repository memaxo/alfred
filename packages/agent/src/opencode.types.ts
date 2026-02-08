declare module "@alfred/oh-my-opencode-slim" {
  export interface TmuxSpawnOptions {
    runId: string;
    cmd: string;
    args?: string[];
    containerName: string;
    cwd: string;
    env: Record<string, string>;
    mode: "acp" | "http";
    port: number;
  }

  export interface TmuxSession {
    attached: boolean;
    createdAt: number;
    name: string;
    runId: string;
  }

  export function capturePane(
    paneId: string,
    opts?: { lines?: number }
  ): Promise<string>;
  export function isOhMyOpencodeSlimEnabled(): boolean;
  export function isTmuxAvailable(): Promise<boolean>;
  export function listSessions(): Promise<TmuxSession[]>;
  export function spawnInTmux(
    options: TmuxSpawnOptions
  ): Promise<{ paneId: string; sessionName: string }>;
  export function stopTmuxSession(runId: string): Promise<boolean>;
}
