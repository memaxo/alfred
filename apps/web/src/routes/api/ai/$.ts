import { createFileRoute } from "@tanstack/react-router";
import { google } from "@ai-sdk/google";
import { streamText, type UIMessage, convertToModelMessages } from "ai";

export const Route = createFileRoute("/api/ai/$")({
	loader: async () => {
		// Return initial state for SSR
		return {
			initialMessages: [] as UIMessage[],
		};
	},
	action: async ({ request }) => {
		// Handle POST requests via action
		if (request.method !== "POST") {
			return new Response("Method not allowed", { status: 405 });
		}

		try {
			const { messages }: { messages: UIMessage[] } = await request.json();

			const result = streamText({
				model: google("gemini-2.5-flash"),
				messages: convertToModelMessages(messages),
			});

			return result.toUIMessageStreamResponse();
		} catch (error) {
			console.error("AI API error:", error);
			return new Response(
				JSON.stringify({ error: "Failed to process AI request" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	},
	server: {
		handlers: {
			POST: async ({ request }) => {
				// Keep handler for backward compatibility and streaming support
				try {
					const { messages }: { messages: UIMessage[] } = await request.json();

					const result = streamText({
						model: google("gemini-2.5-flash"),
						messages: convertToModelMessages(messages),
					});

					return result.toUIMessageStreamResponse();
				} catch (error) {
					console.error("AI API error:", error);
					return new Response(
						JSON.stringify({ error: "Failed to process AI request" }),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
			},
		},
	},
});
