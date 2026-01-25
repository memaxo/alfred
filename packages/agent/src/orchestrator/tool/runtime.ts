import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { z } from "zod";

import type { ToolExecuteArgs } from "./shared/context.js";

const runtimeInputSchema = z.object({
  action: z.enum(["status", "recover", "logs"]),
  authz: z.string().optional(),
  component: z.enum(["voice", "embed", "alfred", "all"]).optional(),
  tail: z.number().int().min(1).max(1000).default(100).optional(),
});

type RuntimeInput = z.infer<typeof runtimeInputSchema>;

async function enforcePolicy(input: RuntimeInput) {
  const scope = input.action === "status" ? "deploy.read" : "deploy.write";
  await requireToolScopesAndPolicy(input.authz, [scope], {
    action: `runtime.${input.action}`,
    resource: {
      id: input.component ?? "all",
      kind: "runtime",
    },
  });
}

export const toolRuntime = {
  description:
    "Monitor and recover ALFRED runtime components (voice, embed, alfred).",
  execute: async ({ input }: ToolExecuteArgs<RuntimeInput>) => {
    await enforcePolicy(input);

    switch (input.action) {
      case "status": {
        const { getVoicePools, isVoiceInitialized } =
          await import("@alfred/voice/process/pool-manager");
        const { getHealth: getEmbedHealth } = await import("@alfred/embed");

        let voiceStatus: { stt: unknown[]; tts: unknown[] } = {
          stt: [],
          tts: [],
        };
        if (isVoiceInitialized()) {
          try {
            const { sttPool, ttsPool } = getVoicePools();
            voiceStatus = {
              stt: sttPool.getHealth() as unknown[],
              tts: ttsPool.getHealth() as unknown[],
            };
          } catch {
            // Not initialized
          }
        }

        return {
          voice: voiceStatus,
          embed: getEmbedHealth(),
          env: {
            VOICE_PROVIDER: process.env.VOICE_PROVIDER,
            EMBED_DEVICE: process.env.EMBED_DEVICE,
            VOICE_STREAMING_PROTO: process.env.VOICE_STREAMING_PROTO,
          },
          uptime: process.uptime(),
        };
      }

      case "recover": {
        const results: Record<string, boolean> = {};
        const component = input.component ?? "all";

        if (component === "voice" || component === "all") {
          const { shutdownVoicePools, initializeVoicePools } =
            await import("@alfred/voice/process/pool-manager");
          await shutdownVoicePools().catch(() => {});
          await initializeVoicePools();
          results.voice = true;
        }

        if (component === "embed" || component === "all") {
          const { shutdown: shutdownEmbedPool } = await import("@alfred/embed");
          await shutdownEmbedPool().catch(() => {});
          results.embed = true;
        }

        return { ok: true, results };
      }

      case "logs": {
        // Use a direct implementation to avoid cross-package src imports from packages/api
        const component = input.component ?? "alfred";
        const tail = input.tail ?? 100;

        // List containers
        const psProc = Bun.spawn(
          ["docker", "ps", "--no-trunc", "--format", "{{json .}}"],
          {
            stdout: "pipe",
            stderr: "pipe",
          }
        );
        const psOutput = await new Response(psProc.stdout).text();
        await psProc.exited;

        const containers = psOutput
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            try {
              const raw = JSON.parse(line);
              return { id: raw.ID, name: raw.Names, image: raw.Image };
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        const container = containers.find((c) => {
          if (!c) {
            return false;
          }
          const name = c.name.toLowerCase();
          const image = c.image.toLowerCase();

          if (component === "alfred") {
            return (
              name.includes("alfred") &&
              !name.includes("voice") &&
              !name.includes("embed")
            );
          }
          return name.includes(component) || image.includes(component);
        });

        if (!container) {
          throw new Error(`container_not_found_for_${component}`);
        }

        const logsProc = Bun.spawn(
          [
            "docker",
            "logs",
            "--tail",
            String(tail),
            "--timestamps",
            container.id,
          ],
          {
            stdout: "pipe",
            stderr: "pipe",
          }
        );
        const logsOutput = await new Response(logsProc.stdout).text();
        const logsError = await new Response(logsProc.stderr).text();
        await logsProc.exited;

        const logs = [...logsOutput.split("\n"), ...logsError.split("\n")]
          .filter(Boolean)
          .map((line) => {
            const match =
              /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/u.exec(
                line
              );
            return {
              timestamp: match?.[1] ?? new Date().toISOString(),
              message: match?.[2] ?? line,
            };
          });

        return { logs };
      }

      default: {
        throw new Error("runtime_action_not_supported");
      }
    }
  },
  inputSchema: runtimeInputSchema,
  name: "runtime",
  outputSchema: z.any(),
};

export type ToolRuntime = typeof toolRuntime;
