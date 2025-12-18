/// <reference path="../../../tsconfig/types/bun.d.ts" />

import { logger } from "@alfred/logger";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

// Local session types (no exported abstraction per ALFRED rules)
type BunPtySession = {
  kind: "bun";
  proc: Bun.Subprocess & { terminal: Bun.Terminal };
  subscribers: Set<(chunk: string) => void>;
};

type NodePtySession = {
  kind: "node-pty";
  pty: {
    onData: (fn: (data: string) => void) => { dispose: () => void };
    onExit: (fn: () => void) => { dispose: () => void };
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    kill: () => void;
  };
};

type Session = BunPtySession | NodePtySession;

// In-memory store for PTY sessions
const sessions = new Map<string, Session>();

function isPosixHost(): boolean {
  return process.platform !== "win32";
}

function toStringChunk(data: string | Uint8Array): string {
  return typeof data === "string" ? data : new TextDecoder().decode(data);
}

async function getPty() {
  try {
    // Dynamically import node-pty only if available (optional dependency)
    const mod = await import("node-pty");
    return mod.default || mod;
  } catch (error) {
    logger.warn("terminal_pty_unavailable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }
}

export const terminalRouter = router({
  createSession: authedProcedure
    .input(
      z.object({
        cols: z.number().default(80),
        rows: z.number().default(24),
        cwd: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const shell = process.env.SHELL || "bash";
      const sessionId = crypto.randomUUID();

      try {
        // 1) Prefer Bun PTY (POSIX-only)
        if (isPosixHost()) {
          try {
            const subscribers = new Set<(chunk: string) => void>();
            const proc = Bun.spawn([shell], {
              cwd: input.cwd || process.env.HOME,
              env: process.env as Record<string, string>,
              terminal: {
                cols: input.cols,
                rows: input.rows,
                data(_term: Bun.Terminal, data: string | Uint8Array) {
                  const chunk = toStringChunk(data);
                  for (const fn of subscribers) {
                    try {
                      fn(chunk);
                    } catch (err) {
                      logger.warn("terminal_subscriber_error", { error: err });
                    }
                  }
                },
              },
            });

            if (!proc.terminal) {
              throw new Error("Terminal not available on spawned process");
            }
            sessions.set(sessionId, {
              kind: "bun",
              proc: proc as Bun.Subprocess & {
                terminal: Bun.Terminal;
              },
              subscribers,
            });
            proc.exited.finally(() => {
              sessions.delete(sessionId);
            });
            return { sessionId };
          } catch (bunError) {
            logger.warn("terminal_bun_pty_failed", {
              error:
                bunError instanceof Error ? bunError.message : String(bunError),
            });
            // Fall through to node-pty
          }
        }

        // 2) Fallback to node-pty (optional dependency)
        const ptyBackend = await getPty();
        if (!ptyBackend) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Terminal functionality is unavailable on this server",
          });
        }

        const pty = ptyBackend.spawn(shell, [], {
          name: "xterm-color",
          cols: input.cols,
          rows: input.rows,
          cwd: input.cwd || process.env.HOME,
          env: process.env as Record<string, string>,
        });

        sessions.set(sessionId, { kind: "node-pty", pty });
        pty.onExit(() => {
          sessions.delete(sessionId);
        });

        return { sessionId };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        logger.error("terminal_create_failed", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create terminal session",
        });
      }
    }),

  events: authedProcedure
    .input(z.object({ sessionId: z.string() }))
    .subscription(({ input }) =>
      observable<string>((emit) => {
        const session = sessions.get(input.sessionId);
        if (!session) {
          emit.error(
            new TRPCError({
              code: "NOT_FOUND",
              message: "Session not found",
            })
          );
          return () => {};
        }

        if (session.kind === "bun") {
          const fn = (chunk: string) => emit.next(chunk);
          session.subscribers.add(fn);
          session.proc.exited
            .then(() => emit.complete())
            .catch(() => emit.complete());
          return () => {
            session.subscribers.delete(fn);
          };
        }

        const onData = session.pty.onData((data: string) => {
          emit.next(data);
        });
        const onExit = session.pty.onExit(() => {
          emit.complete();
        });

        return () => {
          onData.dispose();
          onExit.dispose();
        };
      })
    ),

  write: authedProcedure
    .input(z.object({ sessionId: z.string(), data: z.string() }))
    .mutation(({ input }) => {
      const session = sessions.get(input.sessionId);
      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }
      if (session.kind === "bun") {
        session.proc.terminal.write(input.data);
        return;
      }
      session.pty.write(input.data);
    }),

  resize: authedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        cols: z.number(),
        rows: z.number(),
      })
    )
    .mutation(({ input }) => {
      const session = sessions.get(input.sessionId);
      if (!session) {
        return;
      }
      if (session.kind === "bun") {
        session.proc.terminal.resize(input.cols, input.rows);
        return;
      }
      session.pty.resize(input.cols, input.rows);
    }),

  kill: authedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(({ input }) => {
      const session = sessions.get(input.sessionId);
      if (!session) {
        return;
      }
      sessions.delete(input.sessionId);
      if (session.kind === "bun") {
        try {
          session.proc.terminal.close();
        } catch {
          // Ignore close errors
        }
        try {
          session.proc.kill();
        } catch {
          // Ignore kill errors
        }
        return;
      }
      session.pty.kill();
    }),
});
