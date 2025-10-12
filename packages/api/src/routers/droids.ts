import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { spawn } from "node:child_process";
import z from "zod";
import { authedProcedure, router } from "../index";
import { requirePolicy } from "../gate";
import { droidExecRunsTotal } from "../metrics";

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
	const args =
		input.args ??
		[
			"-e",
			createScript(input.prompt, input.out),
		];

	return spawn(command, args, {
		cwd: input.cw ?? process.cwd(),
		env: process.env,
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
				},
			),
		)
		.input(droidRunInputSchema)
		.mutation(async ({ input }) => {
			const { claims } = await requireToolScopesAndPolicy(input.authz, ["droid.exec"], {
				action: "droid.exec",
				resource: {
					kind: "repo",
					id: input.cw,
				},
				context: {
					auto: input.auto,
				},
			});

			if (
				(input.auto === "medium" || input.auto === "high") &&
				(!claims.elevated || claims.mfa !== "passkey")
			) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "biometric_required",
				});
			}

			const child = spawnDroidProcess(input);

			const stdoutChunks: string[] = [];
			const stderrChunks: string[] = [];

			child.stdout?.on("data", (chunk) => stdoutChunks.push(chunk.toString()));
			child.stderr?.on("data", (chunk) => stderrChunks.push(chunk.toString()));

			const exitCode: number = await new Promise((resolve, reject) => {
				child.on("error", reject);
				child.on("close", (code) => resolve(code ?? 0));
			});

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
			},
		),
	)
	.input(droidRunInputSchema)
	.subscription(({ input }) =>
		observable<{ type: string; data?: string; code?: number }>((emit) => {
			let child: ReturnType<typeof spawnDroidProcess> | null = null;

			void (async () => {
				const { claims } = await requireToolScopesAndPolicy(input.authz, ["droid.exec"], {
					action: "droid.exec",
					resource: {
						kind: "repo",
						id: input.cw,
					},
					context: {
						auto: input.auto,
					},
				});

				if (
					(input.auto === "medium" || input.auto === "high") &&
					(!claims.elevated || claims.mfa !== "passkey")
				) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "biometric_required",
					});
				}

				child = spawnDroidProcess(input);

				child.stdout?.on("data", (chunk) => {
					emit.next({ type: "stdout", data: chunk.toString() });
				});

				child.stderr?.on("data", (chunk) => {
					emit.next({ type: "stderr", data: chunk.toString() });
				});

				child.on("close", (code) => {
					droidExecRunsTotal.labels(input.auto, String(code ?? 0)).inc();
					emit.next({ type: "exit", code: code ?? 0 });
					emit.complete();
				});

				child.on("error", (error) => {
					emit.error(error);
				});
			})().catch((error) => {
				emit.error(error);
			});

			return () => {
				if (child && !child.killed) {
					child.kill("SIGTERM");
				}
			};
		}),
	),
};

export const droidsRouter: ReturnType<typeof router> = router(droidProcedures);
