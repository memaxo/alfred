// Stub for node-pty to prevent ABI mismatch errors in browser/SSR environments
// This is used when node-pty is imported but shouldn't actually execute

export interface IPty {
  onExit(callback: () => void): { dispose(): void };
  onData(callback: (data: string) => void): { dispose(): void };
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
}

export function spawn(
  file: string,
  args: string[],
  options?: {
    name?: string;
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: Record<string, string>;
  }
): IPty {
  throw new Error(
    "node-pty is not supported in browser/SSR environments. Terminal functionality requires server-side execution."
  );
}
