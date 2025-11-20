import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { RouteError } from "@/components/route-error";
import type { TRPCAppRouter } from "@/utils/trpc";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_authed/dashboard")({
  component: RouteComponent,
  errorComponent: RouteError,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();

  type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
  type PrivateData = RouterOutputs["privateData"];
  const privateDataQuery = trpc.privateData.useQuery() as {
    data: PrivateData | undefined;
  };
  const privateData = privateDataQuery.data;

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome {session.data?.user.name}</p>
      <p>API: {privateData?.message}</p>
    </div>
  );
}
