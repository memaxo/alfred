import { hasStdout, stdoutWrite } from "./env";
import { safeJsonStringify } from "./stringify";

export type LogTransport = {
  write: (line: string) => void;
};

export function createConsoleTransport(): LogTransport {
  return {
    write(line: string) {
      if (hasStdout()) {
        stdoutWrite(`${line}\n`);
        return;
      }
      // biome-ignore lint/suspicious/noConsole: default browser sink
      console.log(line);
    },
  };
}

type LokiConfig = {
  endpoint: string;
  labels: Record<string, string>;
};

/**
 * Best-effort Loki transport.
 *
 * This is intentionally minimal: it is not used by default and does not attempt
 * batching/retries. Configure explicitly at app startup if needed.
 */
export function createLokiTransport(cfg: LokiConfig): LogTransport {
  return {
    write(line: string) {
      const tsNs = `${Date.now()}000000`;
      const payload = {
        streams: [
          {
            stream: cfg.labels,
            values: [[tsNs, line]],
          },
        ],
      };
      void fetch(cfg.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: safeJsonStringify(payload),
        keepalive: true,
      }).catch(() => {});
    },
  };
}
