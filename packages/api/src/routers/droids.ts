import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import z from "zod";
import { requirePolicy } from "../gate";
import { droidExecRunsTotal } from "@alfred/api/metrics";
import { authedProcedure, router } from "../trpc";

const droidRunInputSchema = z.object({
  prompt: z.string().min(1),
  auto: z.enum(["read", "low", "medium", "high"]).default("read"),
  authz: z.string().min(1, "authz token required"),
  out: z.enum(["text", "json", "debug"]).default("text"),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  cw: z.string().optional(),
});

type DroidRunInput = z.infer<typeof droidRunInputSchema>;

function createScript(prompt: string, out: DroidRunInput["out"]) {
  if (out === "json") {
    const payload = { prompt };
    return `console.log(JSON.stringify(${JSON.stringify(payload)}));`;
  }
  return `console.log(${JSON.stringify(`[droid] ${prompt}`)});`;
}

function spawnDroidProcess(input: DroidRunInput) {
  const command = input.command ?? process.execPath;
  const args = input.args ?? ["-e", createScript(input.prompt, input.out)];

  return Bun.spawn([command, ...args], {
    cwd: input.cw ?? process.cwd(),
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
}

const droidProcedures = {
  run: authedProcedure
    .use(
      requirePolicy(
        "droid.exec",
        (raw) => {
          const input = raw as DroidRunInput;
          return {
            kind: "repo",
            id: input.cw,
          };
        },
        (raw) => {
          const input = raw as DroidRunInput;
          return { auto: input.auto };
        }
      )
    )
    .input(droidRunInputSchema)
    .mutation(async ({ input }) => {
      // TODO: Propagate PDP obligations (biometric, approvals) back to the client and support resumable execution.
      const { claims } = await requireToolScopesAndPolicy(
        input.authz,
        ["droid.exec"],
        {
          action: "droid.exec",
          resource: {
            kind: "repo",
            id: input.cw,
          },
          context: {
            auto: input.auto,
          },
        }
      );

      if (
        (input.auto === "medium" || input.auto === "high") &&
        (!claims.elevated || claims.mfa !== "passkey")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "biometric_required",
        });
      }

      const proc = spawnDroidProcess(input);

      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];

      // Handle stdout stream
      if (proc.stdout && typeof proc.stdout !== "number") {
        const reader = proc.stdout.getReader();
        const decoder = new TextDecoder();

        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              stdoutChunks.push(decoder.decode(value));
            }
          } catch {
            // Ignore stream read errors
          }
        })();
      }

      // Handle stderr stream
      if (proc.stderr && typeof proc.stderr !== "number") {
        const reader = proc.stderr.getReader();
        const decoder = new TextDecoder();

        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              stderrChunks.push(decoder.decode(value));
            }
          } catch {
            // Ignore stderr read errors
          }
        })();
      }

      let exitCode = 0;
      try {
        exitCode = await proc.exited;
      } catch (error) {
        throw error;
      }

      droidExecRunsTotal.labels(input.auto, String(exitCode)).inc();

      return {
        exitCode,
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
      };
    }),

  stream: authedProcedure
    .use(
      requirePolicy(
        "droid.exec",
        (raw) => {
          const input = raw as DroidRunInput;
          return {
            kind: "repo",
            id: input.cw,
          };
        },
        (raw) => {
          const input = raw as DroidRunInput;
          return { auto: input.auto };
        }
      )
    )
    .input(droidRunInputSchema)
    .subscription(({ input }) =>
      observable<{ type: string; data?: string; code?: number }>((emit) => {
        let proc: ReturnType<typeof spawnDroidProcess> | null = null;

        void (async () => {
          // TODO: Surface obligations to clients so they can request elevation before opening the stream.
          const { claims } = await requireToolScopesAndPolicy(
            input.authz,
            ["droid.exec"],
            {
              action: "droid.exec",
              resource: {
                kind: "repo",
                id: input.cw,
              },
              context: {
                auto: input.auto,
              },
            }
          );

          if (
            (input.auto === "medium" || input.auto === "high") &&
            (!claims.elevated || claims.mfa !== "passkey")
          ) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "biometric_required",
            });
          }

          proc = spawnDroidProcess(input);

          // Handle stdout stream
          if (proc.stdout && typeof proc.stdout !== "number") {
            const reader = proc.stdout.getReader();
            const decoder = new TextDecoder();

            (async () => {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  emit.next({ type: "stdout", data: decoder.decode(value) });
                }
              } catch (error) {
                emit.error(error);
              }
            })();
          }

          // Handle stderr stream
          if (proc.stderr && typeof proc.stderr !== "number") {
            const reader = proc.stderr.getReader();
            const decoder = new TextDecoder();

            (async () => {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  emit.next({ type: "stderr", data: decoder.decode(value) });
                }
              } catch (error) {
                emit.error(error);
              }
            })();
          }

          // Handle exit
          proc.exited
            .then((code) => {
              droidExecRunsTotal.labels(input.auto, String(code ?? 0)).inc();
              emit.next({ type: "exit", code: code ?? 0 });
              emit.complete();
            })
            .catch((error) => {
              emit.error(error);
            });
        })().catch((error) => {
          emit.error(error);
        });

        return () => {
          if (proc && !proc.killed) {
            proc.kill("SIGTERM");
          }
        };
      })
    ),
};

export const droidsRouter: ReturnType<typeof router> = router(droidProcedures);
