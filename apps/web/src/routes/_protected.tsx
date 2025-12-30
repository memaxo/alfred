import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useJarvis } from "@/components/hud";
import { authClient } from "@/lib/auth-client";
import { getTestSession } from "@/lib/test-auth";

export const Route = createFileRoute("/_protected")({
  ssr: false,
  beforeLoad: async () => {
    const testSession = getTestSession();
    if (testSession) {
      return { user: testSession.user };
    }
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/login" });
    }
    return { user: session.data.user };
  },
  component: ProtectedLayout,
});

function ProtectedLayout() {
  useJarvisHealth();
  return <Outlet />;
}

function useJarvisHealth() {
  const { updateSystemStatus } = useJarvis();

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const start = performance.now();
      try {
        const healthRes = await fetch("/healthz", { cache: "no-store" });
        const apiLatencyMs = Math.round(performance.now() - start);

        let apiOk = healthRes.ok;
        if (apiOk) {
          try {
            const body = (await healthRes.json()) as { ok?: boolean } | null;
            apiOk = body?.ok === true;
          } catch {
            apiOk = false;
          }
        }

        let dbStatus: "nominal" | "degraded" | "critical" | "unknown" =
          "unknown";
        try {
          const depsStart = performance.now();
          const depsRes = await fetch("/healthz/deps", { cache: "no-store" });
          const depsLatencyMs = Math.round(performance.now() - depsStart);
          const depsBody = (await depsRes.json()) as {
            ok?: boolean;
            redis?: "ok" | "unavailable";
          } | null;

          if (depsRes.ok && depsBody?.ok === true) {
            dbStatus =
              depsBody.redis === "unavailable" ? "degraded" : "nominal";
          } else {
            dbStatus = "critical";
          }

          if (cancelled) {
            return;
          }

          const apiStatus = apiOk ? "nominal" : "critical";
          const overall =
            apiStatus === "critical" || dbStatus === "critical"
              ? "critical"
              : dbStatus === "degraded"
                ? "degraded"
                : "nominal";

          updateSystemStatus({
            overall,
            api: {
              status: apiStatus,
              latencyMs: apiLatencyMs,
            },
            database: {
              status: dbStatus,
              connectionCount: undefined,
            },
          });

          // Track deps latency in the API panel if useful.
          if (depsLatencyMs > 0 && apiStatus === "nominal") {
            updateSystemStatus({
              api: {
                status: apiStatus,
                latencyMs: Math.max(apiLatencyMs, depsLatencyMs),
              },
            });
          }
        } catch {
          if (cancelled) {
            return;
          }
          updateSystemStatus({
            overall: apiOk ? "degraded" : "critical",
            api: {
              status: apiOk ? "nominal" : "critical",
              latencyMs: apiLatencyMs,
            },
            database: { status: "unknown" },
          });
        }
      } catch {
        if (cancelled) {
          return;
        }
        updateSystemStatus({
          overall: "critical",
          api: { status: "critical" },
          database: { status: "unknown" },
        });
      }
    }

    poll();
    const interval = setInterval(poll, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [updateSystemStatus]);
}
