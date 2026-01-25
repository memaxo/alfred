import { spawn } from "node:child_process";
import { platform } from "node:os";

export function openBrowser(url: string): Promise<void> {
  const os = platform();

  let command: string;
  let args: string[];

  switch (os) {
    case "darwin": {
      command = "open";
      args = [url];
      break;
    }
    case "win32": {
      command = "cmd";
      args = ["/c", "start", url];
      break;
    }
    default: {
      // Linux and others
      command = "xdg-open";
      args = [url];
    }
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });

    proc.on("error", reject);
    proc.unref();
    resolve();
  });
}
