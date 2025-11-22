import { logger } from "@alfred/logger";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

// Mock IPty interface (for reference/typing of dynamic import)
// interface IPty {
//   spawn(file: string, args: string[], options: any): IPty;
//   on(event: string, listener: any): void;
//   onExit(listener: any): { dispose: () => void };
//   onData(listener: any): { dispose: () => void };
//   resize(cols: number, rows: number): void;
//   write(data: string): void;
//   kill(signal?: string): void;
//   dispose(): void;
// }

// In-memory store for PTY sessions
const sessions = new Map<string, any>();

async function getPty() {
  try {
    // Dynamically import node-pty only if available
    // @ts-ignore - optional dependency
    const mod = await import("node-pty");
    return mod.default || mod;
  } catch (error) {
    logger.warn("terminal_pty_unavailable", { error: error instanceof Error ? error.message : String(error) });
    return undefined;
  }
}

export const terminalRouter: ReturnType<typeof router> = router({
  createSession: authedProcedure
    .input(
      z.object({
        cols: z.number().default(80),
        rows: z.number().default(24),
        cwd: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const ptyBackend = await getPty();
      if (!ptyBackend) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Terminal functionality is unavailable on this server",
        });
      }

      const shell = process.env.SHELL || "bash";
      const sessionId = crypto.randomUUID();

      try {
        const ptyProcess = ptyBackend.spawn(shell, [], {
          name: "xterm-color",
          cols: input.cols,
          rows: input.rows,
          cwd: input.cwd || process.env.HOME,
          env: process.env as Record<string, string>,
        });

        sessions.set(sessionId, ptyProcess);

        // Handle exit
        ptyProcess.onExit(() => {
          sessions.delete(sessionId);
        });

        return { sessionId };
      } catch (error) {
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
        const ptyProcess = sessions.get(input.sessionId);
        if (!ptyProcess) {
          emit.error(
            new TRPCError({
              code: "NOT_FOUND",
              message: "Session not found",
            })
          );
          return () => {};
        }

        const onData = ptyProcess.onData((data: string) => {
          emit.next(data);
        });

        const onExit = ptyProcess.onExit(() => {
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
      const ptyProcess = sessions.get(input.sessionId);
      if (!ptyProcess) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }
      ptyProcess.write(input.data);
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
      const ptyProcess = sessions.get(input.sessionId);
      if (ptyProcess) {
        ptyProcess.resize(input.cols, input.rows);
      }
    }),

  kill: authedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(({ input }) => {
      const ptyProcess = sessions.get(input.sessionId);
      if (ptyProcess) {
        ptyProcess.kill();
        sessions.delete(input.sessionId);
      }
    }),
});
