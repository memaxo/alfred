import { createFileRoute, Link } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { RouteError } from "@/components/route-error";
import type { TRPCAppRouter } from "@/utils/trpc";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/")({
  component: HomeComponent,
  errorComponent: RouteError,
});

const TITLE_TEXT = `
 ██████╗ ███████╗████████╗████████╗███████╗██████╗
 ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗
 ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝
 ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗
 ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║
 ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝

 ████████╗    ███████╗████████╗ █████╗  ██████╗██╗  ██╗
 ╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝
    ██║       ███████╗   ██║   ███████║██║     █████╔╝
    ██║       ╚════██║   ██║   ██╔══██║██║     ██╔═██╗
    ██║       ███████║   ██║   ██║  ██║╚██████╗██║  ██╗
    ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
 `;

function HomeComponent() {
  type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
  type HealthCheckOutput = RouterOutputs["healthCheck"];
  const healthCheckQuery = trpc.healthCheck.useQuery() as {
    data: HealthCheckOutput | undefined;
    isLoading: boolean;
  };
  const { data: healthCheck, isLoading } = healthCheckQuery;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-2">
      <pre className="overflow-x-auto font-mono text-sm">{TITLE_TEXT}</pre>
      <div className="grid gap-6">
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">API Status</h2>
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${healthCheck ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-muted-foreground text-sm">
              {isLoading
                ? "Checking..."
                : healthCheck
                  ? "Connected"
                  : "Disconnected"}
            </span>
          </div>
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">Enter the Mindscape</h2>
          <p className="text-muted-foreground text-sm">
            Open the spatial canvas to chat, capture notes, run workflows, and manage Alfred in one place.
          </p>
          <Link
            className="inline-flex h-9 items-center justify-center rounded bg-primary px-4 font-medium text-primary-foreground text-sm"
            to="/mindscape"
          >
            Launch Mindscape
          </Link>
        </section>
      </div>
    </div>
  );
}
