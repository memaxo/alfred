/**
 * Mock HTTP server for Harbor evaluations
 */

import { createGithubHandler, type GithubConfig } from "./github.js";
import { createLinearHandler, type LinearConfig } from "./linear.js";

export type MockConfig = {
  linear?: LinearConfig;
  github?: GithubConfig;
  port?: number;
};

export type MockRequest = {
  path: string;
  method: string;
  body: unknown;
  timestamp: number;
};

export type MockServer = {
  start(): { linearUrl: string; githubCliStub: string };
  stop(): void;
  getRequests(): MockRequest[];
  clearRequests(): void;
};

/**
 * Create a mock server for Linear and GitHub APIs
 */
export function createMockServer(config: MockConfig): MockServer {
  const requests: MockRequest[] = [];
  let server: ReturnType<typeof Bun.serve> | null = null;

  const linearHandler = createLinearHandler(config.linear);
  const githubHandler = createGithubHandler(config.github);

  return {
    start() {
      server = Bun.serve({
        port: config.port ?? 0,
        async fetch(req) {
          const url = new URL(req.url);
          const body =
            req.method !== "GET"
              ? await req.json().catch(() => ({}))
              : undefined;

          requests.push({
            path: url.pathname,
            method: req.method,
            body,
            timestamp: Date.now(),
          });

          // Route to appropriate handler
          if (url.pathname.startsWith("/linear")) {
            return linearHandler(req, body as Record<string, unknown>);
          }
          if (url.pathname.startsWith("/github")) {
            return githubHandler(req, body as Record<string, unknown>);
          }

          return new Response("Not Found", { status: 404 });
        },
      });

      const baseUrl = `http://127.0.0.1:${server.port}`;
      return {
        linearUrl: `${baseUrl}/linear`,
        githubCliStub: `${baseUrl}/github`,
      };
    },

    stop() {
      if (server) {
        server.stop();
        server = null;
      }
    },

    getRequests() {
      return [...requests];
    },

    clearRequests() {
      requests.length = 0;
    },
  };
}
