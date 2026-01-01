import { appRouter } from "@alfred/api/router";
import { trpcCli } from "trpc-cli";
import { authCommands } from "../commands/auth";
import { initializeRegistry } from "../registry";
import { setupCompletions } from "./completions";
import { createCliContext, createCliHelpContext } from "./context";

export async function runCli(args: string[]): Promise<void> {
  const isTui = args[0] === "tui";
  if (!isTui && process.stdout.isTTY && process.stdin.isTTY) {
    // Setup tab completions (interactive CLI only; never for TUI).
    setupCompletions();
  }

  try {
    const wantsHelp =
      args.includes("--help") ||
      args.includes("-h") ||
      args.length === 0 ||
      (args.length === 1 && args[0]?.trim().length === 0);

    // Handle auth commands separately (not via trpc-cli).
    // Must run BEFORE registry initialization so `alfred auth status` stays fast and never
    // fails due to optional package manifests (e.g. voice/python deps).
    if (args[0] === "auth") {
      return await authCommands(args.slice(1));
    }

    // JARVIS convenience commands (kept outside registry init for fast UX).
    if (args[0] === "jarvis") {
      const { jarvisCommands } = await import("../commands/jarvis");
      return await jarvisCommands(args.slice(1));
    }
    if (args[0] === "ask") {
      const { askCommand } = await import("../commands/jarvis");
      return await askCommand(args.slice(1));
    }
    if (args[0] === "voice") {
      const { voiceCommands } = await import("../commands/voice");
      return await voiceCommands(args.slice(1));
    }

    // Handle TUI commands (also before registry init).
    if (args[0] === "tui") {
      return await handleTuiCommand(args.slice(1));
    }

    // Skip registry initialization for pure help paths to avoid heavy side effects.
    const registry = wantsHelp ? null : await initializeRegistry();

    // Handle registry commands (e.g., "alfred db:migrate", "alfred voice:test-stt").
    if (
      registry &&
      args[0] &&
      (args[0].includes(":") || registry.findCommand(args[0]))
    ) {
      return await handleRegistryCommand(args, registry);
    }

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
  const isHeadless =
    args.includes("--headless") || process.env.ALFRED_TUI_HEADLESS === "true";

  const tuiArgs = args.filter((a) => a !== "--headless");
  const subCommand = tuiArgs[0];
  const wantsHelp =
    subCommand === "help" ||
    tuiArgs.includes("--help") ||
    tuiArgs.includes("-h");

  // Help should be printable in any environment.
  if (wantsHelp) {
    printTuiHelp();
    return;
  }

  if (!(isHeadless || (process.stdout.isTTY && process.stdin.isTTY))) {
    process.stderr.write(
      "tui_requires_tty (set ALFRED_TUI_HEADLESS=true or pass --headless for tests)\n"
    );
    process.exitCode = 1;
    return;
  }

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

    default: {
      // No subcommand or unknown - run dashboard
      const { runTui } = await import("../tui");
      // Respect skip flags from env or args
      const skipIntro =
        tuiArgs.includes("--skip-intro") ||
        process.env.ALFRED_TUI_SKIP_INTRO === "true";
      const skipChecks =
        tuiArgs.includes("--skip-checks") ||
        process.env.ALFRED_TUI_SKIP_CHECKS === "true";

      return await runTui({ skipIntro, skipChecks });
    }
  }
}

function printTuiHelp(): void {
  process.stdout.write(
    `${`
ALFRED TUI - Terminal User Interface

Usage: alfred tui [subcommand]

Subcommands:
  chat        Interactive chat mode
  plan        Planning mode
  debug       Debug console
  <none>      Launch dashboard (default)

Options:
  --skip-intro   Skip intro animation
  --skip-checks  Skip system readiness checks
  --headless     Allow running without a TTY (intended for tests)
  --help, -h     Show this help

Keyboard Shortcuts:
  q           Quit
  ?           Show help
  Tab         Next panel
  Shift+Tab   Previous panel
`.trim()}\n`
  );
}

// ─── Registry Command Handler ─────────────────────────────────────────────────

async function handleRegistryCommand(
  args: string[],
  registry: Awaited<ReturnType<typeof initializeRegistry>>
): Promise<void> {
  const commandName = args[0];
  if (!commandName) {
    process.stderr.write("No command specified\n");
    process.exit(1);
  }

  const cmd = registry.findCommand(commandName);
  if (!cmd) {
    process.stderr.write(`Unknown command: ${commandName}\n`);
    process.stderr.write("Try 'alfred --help' for available commands\n");
    process.exit(1);
  }

  // Parse arguments (simple implementation - could be enhanced with yargs/commander)
  const cmdArgs: Record<string, boolean | number | string> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (!arg) {
      continue;
    }

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      // Check if next arg is a value or another flag
      if (nextArg && !nextArg.startsWith("--")) {
        // Try to parse as number or boolean
        if (nextArg === "true" || nextArg === "false") {
          cmdArgs[key] = nextArg === "true";
        } else if (Number.isNaN(Number(nextArg))) {
          cmdArgs[key] = nextArg;
        } else {
          cmdArgs[key] = Number(nextArg);
        }
        i++; // Skip next arg
      } else {
        // Boolean flag
        cmdArgs[key] = true;
      }
    }
  }

  // Validate with Zod schema if available
  if (cmd.args) {
    try {
      const validated = cmd.args.parse(cmdArgs);
      await cmd.handler(validated);
    } catch (error) {
      process.stderr.write(`Invalid arguments: ${(error as Error).message}\n`);
      process.exit(1);
    }
  } else {
    await cmd.handler(cmdArgs);
  }
}
