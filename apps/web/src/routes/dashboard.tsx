import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import type { TRPCAppRouter } from "@/utils/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
	component: RouteComponent,
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			redirect({
				to: "/login",
				throw: true,
			});
		}
		return { session };
	},
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
