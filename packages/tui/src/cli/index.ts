import { appRouter } from "@alfred/api/router";
import { trpcCli } from "trpc-cli";
import { authCommands } from "../commands/auth";
import { setupCompletions } from "./completions";
import { createCliContext, createCliHelpContext } from "./context";

export async function runCli(args: string[]): Promise<void> {
  // Setup tab completions
  setupCompletions();

  try {
    // Handle auth commands separately (not via trpc-cli)
    if (args[0] === "auth") {
      return await authCommands(args.slice(1));
    }

    // Handle TUI commands
    if (args[0] === "tui") {
      return await handleTuiCommand(args.slice(1));
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

// ─── TUI Command Handler ───────────────────────────────────────────────────────

async function handleTuiCommand(args: string[]): Promise<void> {
  const subCommand = args[0];

  switch (subCommand) {
    case "chat": {
      const { runChatMode } = await import("../tui/modes/chat");
      return await runChatMode();
    }

    case "plan": {
      const { runPlanMode } = await import("../tui/modes/plan");
      return await runPlanMode();
    }

    case "debug": {
      const { runDebugMode } = await import("../tui/modes/debug");
      return await runDebugMode();
    }

    case "help":
    case "--help":
    case "-h":
      printTuiHelp();
      return;

    default: {
      // No subcommand or unknown - run dashboard
      const { runTui } = await import("../tui");
      return await runTui({ skipIntro: subCommand === "--skip-intro" });
    }
  }
}

function printTuiHelp(): void {}
