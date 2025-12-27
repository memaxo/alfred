import { appRouter } from "@alfred/api";
import omelette from "omelette";

// Extract router names from appRouter
function getRouterNames(): string[] {
  const procedures = (appRouter as any)._def.procedures;
  const routerKeys = Object.keys(procedures);
  const routers = new Set<string>();

  for (const key of routerKeys) {
    const parts = key.split(".");
    if (parts.length > 1) {
      routers.add(parts[0]!);
    }
  }

  return Array.from(routers);
}

// Get procedures for a router
function getProcedures(routerName: string): string[] {
  const procedures = Object.keys(appRouter._def.procedures);
  return procedures
    .filter((p) => p.startsWith(`${routerName}.`))
    .map((p) => p.replace(`${routerName}.`, ""));
}

export function setupCompletions(): void {
  const completion = omelette("alfred");

  // First level: routers + auth
  completion.on(
    "$1",
    ({ reply }: { reply: (suggestions: string[]) => void }) => {
      const routers = getRouterNames();
      reply(["auth", ...routers, "--help", "--setup-completions", "--json"]);
    }
  );

  // Second level: procedures or auth subcommands
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
