import { appRouter } from "@alfred/api/router";
import { trpcCli } from "trpc-cli";
import { authCommands } from "../commands/auth";
import { setupCompletions } from "./completions";
import { createCliContext, createCliHelpContext } from "./context";

export async function runCli(args: string[]) {
  // Setup tab completions
  setupCompletions();

  try {
  // Handle auth commands separately (not via trpc-cli)
  if (args[0] === "auth") {
      return await authCommands(args.slice(1));
  }

  const wantsHelp =
    args.includes("--help") ||
    args.includes("-h") ||
    args.length === 0 ||
    (args.length === 1 && args[0]?.trim().length === 0);

  // trpc-cli expects a concrete context object (not a function).
  // ALFRED's context creation is async (credentials + refresh), so we resolve it once up-front.
  const ctx = wantsHelp ? createCliHelpContext() : await createCliContext();

  // Create trpc-cli instance
  const cli = trpcCli({
    router: appRouter,
    context: ctx,
  });

  // Run CLI
  await cli.run({ argv: args });
  } finally {
    // `omelette(...).init()` can resume stdin; pausing prevents Bun tests from
    // hanging after all tests complete (open stdin handle).
    try {
      process.stdin.pause();
    } catch {
      // ignore
    }
  }
}
