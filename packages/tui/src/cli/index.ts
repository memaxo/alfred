import { appRouter } from "@alfred/api";
import { trpcCli } from "trpc-cli";
import { authCommands } from "../commands/auth";
import { setupCompletions } from "./completions";
import { createCliContext } from "./context";

export async function runCli(args: string[]) {
  // Setup tab completions
  setupCompletions();

  // Handle auth commands separately (not via trpc-cli)
  if (args[0] === "auth") {
    return authCommands(args.slice(1));
  }

  // Create trpc-cli instance
  const cli = trpcCli({
    router: appRouter,
    context: createCliContext as any,
  });

  // Run CLI
  await (cli as any).run(args);
}
