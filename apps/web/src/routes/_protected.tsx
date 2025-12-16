import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
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
  return <Outlet />;
}
