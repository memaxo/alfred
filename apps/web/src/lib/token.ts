import type { AppRouter } from "@alfred/api/routers/index";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { authClient } from "@/lib/auth-client";

const trpc = createTRPCClient<AppRouter>({
	links: [
		httpBatchLink({
			url: "/api/trpc",
			fetch(url, options) {
				return fetch(url, {
					...options,
					credentials: "include",
				});
			},
		}),
	],
});

function assertScopes(scopes: string[]) {
	if (!Array.isArray(scopes) || scopes.length === 0) {
		throw new Error("scopes_required");
	}
}

export async function getToolToken(
	scopes: string[],
	auto: "read" | "low" | "medium" | "high",
) {
	assertScopes(scopes);

	if (auto === "medium" || auto === "high") {
		try {
			await authClient.signIn.passkey({ autoFill: true });
		} catch (error) {
			throw new Error(error instanceof Error ? error.message : "passkey_failed");
		}
		const { token } = await trpc.token.elevate.mutate({ scopes });
		return token;
	}

	const { token } = await trpc.token.issue.mutate({ scopes });
	return token;
}

/**
 * Backwards-compatible helper used in dev tools to mint elevated tokens.
 */
export async function getElevatedToolToken(scopes: string[]) {
	return getToolToken(scopes, "medium");
}
