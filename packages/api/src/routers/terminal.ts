import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import * as pty from "node-pty";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";
import { logger } from "../utils/logger";

// In-memory store for PTY sessions
// In a distributed system, this would need to be redis/etc, but for local/single-instance it's fine.
const sessions = new Map<string, pty.IPty>();

export const terminalRouter = router({
  createSession: authedProcedure
    .input(
      z.object({
        cols: z.number().default(80),
        rows: z.number().default(24),
        cwd: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const shell = process.env.SHELL || "bash";
      const sessionId = crypto.randomUUID();

      try {
        const ptyProcess = pty.spawn(shell, [], {
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
    .subscription(({ input }) => {
      return observable<string>((emit) => {
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

        const onData = ptyProcess.onData((data) => {
          emit.next(data);
        });

        const onExit = ptyProcess.onExit(() => {
          emit.complete();
        });

        return () => {
          onData.dispose();
          onExit.dispose();
        };
      });
    }),

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
