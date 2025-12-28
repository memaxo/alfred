import { appRouter } from "@alfred/api/router";
import omelette from "omelette";
import { getRegistry } from "../registry";

type RouterWithProcedures = {
  _def: { procedures: Record<string, unknown> };
};

function getProceduresMap(): Record<string, unknown> {
  return (appRouter as unknown as RouterWithProcedures)._def.procedures;
}

// Extract router names from appRouter
function getRouterNames(): string[] {
  const routerKeys = Object.keys(getProceduresMap());
  const routers = new Set<string>();

  for (const key of routerKeys) {
    const parts = key.split(".");
    if (parts.length > 1) {
      const head = parts[0];
      if (head) {
        routers.add(head);
      }
    }
  }

  return Array.from(routers);
}

// Get procedures for a router
function getProcedures(routerName: string): string[] {
  const procedures = Object.keys(getProceduresMap());
  return procedures
    .filter((p) => p.startsWith(`${routerName}.`))
    .map((p) => p.replace(`${routerName}.`, ""));
}

// Get registry commands
function getRegistryCommands(): string[] {
  try {
    const registry = getRegistry();
    const commands = registry.getAllCommands();
    return commands.map((cmd) => {
      const pkgShort = cmd.package.replace("@alfred/", "");
      return `${pkgShort}:${cmd.name}`;
    });
  } catch {
    return [];
  }
}

export function setupCompletions(): void {
  const completion = omelette("alfred");

  // First level: routers + auth + tui + registry commands
  completion.on(
    "$1",
    ({ reply }: { reply: (suggestions: string[]) => void }) => {
      const routers = getRouterNames();
      const registryCommands = getRegistryCommands();
      reply([
        "auth",
        "tui",
        ...routers,
        ...registryCommands,
        "--help",
        "--setup-completions",
        "--json",
      ]);
    }
  );

  // Second level: procedures or auth subcommands or tui subcommands
  completion.on(
    "$2",
    ({
      before,
      reply,
    }: {
      before?: string;
      reply: (suggestions: string[]) => void;
    }) => {
      const router = before ?? "";

      if (router === "auth") {
        reply(["login", "local", "logout", "status", "elevate"]);
        return;
      }

      if (router === "tui") {
        reply(["chat", "plan", "debug", "--help", "--skip-intro"]);
        return;
      }

      const procedures = getProcedures(router);
      reply([...procedures, "--help"]);
    }
  );

  // Initialize completions
  completion.init();

  // Handle completion installation
  if (process.argv.includes("--setup-completions")) {
    completion.setupShellInitFile?.();
    process.exit(0);
  }
}
