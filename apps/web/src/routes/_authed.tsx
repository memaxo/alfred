import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { RouteError } from "@/components/route-error";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({
        to: "/login",
        search: { redirect: location.href },
        throw: true,
      });
    }
    redirect({
      to: "/mindscape",
      throw: true,
    });
    return { session };
  },
  component: AuthedLayout,
  errorComponent: RouteError,
});

function AuthedLayout() {
  return <Outlet />;
}
