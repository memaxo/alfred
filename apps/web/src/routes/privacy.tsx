import { useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { TRPCAppRouter } from "@/utils/trpc";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";
import { toast } from "sonner";

type FactList = inferRouterOutputs<TRPCAppRouter>["privacy"]["facts"];
type EventList = inferRouterOutputs<TRPCAppRouter>["privacy"]["events"];
type DeleteFactInput = inferRouterInputs<TRPCAppRouter>["privacy"]["deleteFact"];

export const Route = createFileRoute("/privacy")({
	component: PrivacyRoute,
});

function PrivacyRoute() {
	const utils = trpc.useUtils();
	const factInput = useMemo(() => ({ limit: 20, offset: 0 }), []);
	const eventInput = useMemo(() => ({ limit: 50, offset: 0 }), []);

	const factQuery = trpc.privacy.facts.useQuery(factInput);
	const eventQuery = trpc.privacy.events.useQuery(eventInput);

	const facts = factQuery.data ?? [];
	const events = eventQuery.data ?? [];

	const deleteFact = trpc.privacy.deleteFact.useMutation({
		onMutate: async (input) => {
			await utils.privacy.facts.cancel(factInput);
			const previous = utils.privacy.facts.getData(factInput);
			utils.privacy.facts.setData(factInput, (current) => {
				const base = Array.isArray(current) ? current : [];
				return base.filter((fact) => fact?.id !== input.id) as FactList;
			});
			return { previous };
		},
		onError: (error, _input, context) => {
			utils.privacy.facts.setData(factInput, context?.previous as FactList);
			toast.error(error.message ?? "privacy_delete_failed");
		},
		onSuccess: () => {
			toast.success("Fact deleted");
		},
		onSettled: async () => {
			await utils.privacy.facts.invalidate(factInput);
		},
	});

	const handleDelete = useCallback(
		(id: string) => {
			if (deleteFact.isPending) {
				return;
			}
			const input: DeleteFactInput = {
				id,
			};
			deleteFact.mutate(input);
		},
		[deleteFact],
	);

	const isFactsLoading = factQuery.isLoading;
	const isEventsLoading = eventQuery.isLoading;

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-10">
			<Card>
				<CardHeader>
					<CardTitle>Stored facts</CardTitle>
					<CardDescription>
						Review semantic facts and remove entries you no longer need.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isFactsLoading ? (
						<p className="text-sm text-muted-foreground">Loading facts…</p>
					) : facts.length === 0 ? (
						<p className="text-sm text-muted-foreground">No stored facts.</p>
					) : (
						<ul className="space-y-4">
							{facts.map((fact) => (
								<li className="rounded-md border p-4 shadow-sm" key={fact.id}>
									<div className="flex items-start justify-between gap-4">
										<div className="space-y-2">
											<p className="text-sm text-muted-foreground">
												{new Date(fact.created ?? fact.updated ?? Date.now()).toLocaleString()}
											</p>
											<p className="whitespace-pre-wrap text-sm">{fact.content}</p>
											<div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
												{fact.category ? <span>Category: {fact.category}</span> : null}
												<span>Source: {fact.source ?? "unknown"}</span>
												{typeof fact.confidence === "number" ? (
													<span>Confidence: {fact.confidence.toFixed(2)}</span>
												) : null}
											</div>
										</div>
										<Button
											disabled={deleteFact.isPending}
											onClick={() => handleDelete(fact.id)}
											size="sm"
											variant="outline"
										>
											Delete
										</Button>
									</div>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Recent events</CardTitle>
					<CardDescription>Most recent activity across the system.</CardDescription>
				</CardHeader>
				<CardContent>
					{isEventsLoading ? (
						<p className="text-sm text-muted-foreground">Loading events…</p>
					) : events.length === 0 ? (
						<p className="text-sm text-muted-foreground">No events captured.</p>
					) : (
						<ul className="space-y-4">
							{events.map((event) => (
								<li className="rounded-md border p-4 shadow-sm" key={event.id}>
									<div className="flex flex-col gap-2">
										<div className="flex items-center justify-between">
											<h3 className="text-base font-semibold">{event.type}</h3>
											<span className="text-xs text-muted-foreground">
												{new Date(event.timestamp ?? Date.now()).toLocaleString()}
											</span>
										</div>
										<pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-xs">
											{JSON.stringify(event.data, null, 2)}
										</pre>
										{event.metadata ? (
											<pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-xs">
												{JSON.stringify(event.metadata, null, 2)}
											</pre>
										) : null}
									</div>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
