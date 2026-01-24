import type { ProjectConfig } from "../../utils/project-detector";

import {
  DEFAULT_ALLOW_PREFIXES,
  openDirectorySecure,
} from "../../security/filesystem";
import { spawnWithSecureCwd } from "../../security/secure-spawn";

type SmokeResult = {
  success: boolean;
  message: string;
};

function formatOutput(stdout: string, stderr: string): string {
  const out = stdout.trim();
  const err = stderr.trim();
  if (out && err) {
    return `${out}\n\n${err}`;
  }
  return out || err || "(no output)";
}

function cap(text: string, max = 8000): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}...`;
}

async function readText(
  stream: ReadableStream<Uint8Array> | null | undefined
): Promise<string> {
  if (!stream) {
    return "";
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";

  try {
    while (text.length < 12_000) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

export const smokeTester = {
  async verify(
    workspaceRoot: string,
    projectConfig: ProjectConfig
  ): Promise<SmokeResult> {
    const command =
      projectConfig.type === "node"
        ? "bun run smoke:hypergraph"
        : projectConfig.testCommand;

    const cwdHandle = openDirectorySecure(workspaceRoot, {
      allowedPrefixes: DEFAULT_ALLOW_PREFIXES,
    });

    try {
      const proc = spawnWithSecureCwd({
        cwdHandle,
        cmd: "bash",
        args: ["-lc", command],
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([
        readText(typeof proc.stdout === "number" ? null : proc.stdout),
        readText(typeof proc.stderr === "number" ? null : proc.stderr),
        proc.exited,
      ]);

      if (exitCode === 0) {
        return { success: true, message: "smoke_ok" };
      }

      return {
        success: false,
        message: cap(formatOutput(stdout, stderr)),
      };
    } finally {
      cwdHandle.close();
    }
  },
} as const;
