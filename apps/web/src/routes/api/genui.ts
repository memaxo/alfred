import { uiComponentSchema } from "@alfred/type/genui.zod";
import { streamObject } from "ai";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const requestSchema = z.object({
  input: z.string().min(1),
  data: z.unknown().optional(),
  context: z
    .object({
      mode: z.enum(["assistant", "workflow", "focus"]).optional(),
      surface: z.enum(["web", "mobile", "voice", "tui"]).optional(),
      viewport: z
        .object({
          width: z.number().int().positive().optional(),
          height: z.number().int().positive().optional(),
        })
        .optional(),
    })
    .passthrough()
    .optional(),
});

async function handleGenUiRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authPkg = "@alfred/auth";
  const { auth } = await import(
    /* @vite-ignore */
    authPkg
  );
  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return Response.json(
      { error: "session_required" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  let parsed: z.infer<typeof requestSchema>;
  try {
    const raw = await request.json();
    const result = requestSchema.safeParse(raw);
    if (!result.success) {
      return Response.json(
        { error: "invalid_request", issues: result.error.issues },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    parsed = result.data;
  } catch {
    return Response.json(
      { error: "invalid_json" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const { getModelForRole, supportsGenUI } = await import("@alfred/agent/selector");
  const selection = await getModelForRole("classify", { userId });
  if (!supportsGenUI(selection)) {
    return Response.json(
      { error: "genui_unsupported", model: selection.modelKey },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const mode = parsed.context?.mode ?? "assistant";
  const surface = parsed.context?.surface ?? "web";
  const viewport = parsed.context?.viewport;

  const prompt = [
    "Generate a single UIComponent JSON object matching the schema.",
    `Allowed components include: chart, grid, list, number, plan, task, term, code, panel, workflow-timeline, progress-window, streaming-terminal.`,
    `Surface: ${surface}`,
    `Mode: ${mode}`,
    viewport ? `Viewport: ${JSON.stringify(viewport)}` : "Viewport: unknown",
    "",
    "User prompt:",
    parsed.input,
    "",
    parsed.data !== undefined ? `Backing data (JSON): ${JSON.stringify(parsed.data)}` : "",
  ]
    .filter((v) => v.length > 0)
    .join("\n");

  const result = streamObject({
    model: selection.model,
    schema: uiComponentSchema,
    prompt,
    temperature: 0,
    abortSignal: request.signal.aborted ? undefined : request.signal,
  });

  const response = result.toTextStreamResponse({
    headers: {
      "Cache-Control": "no-store",
      "x-model": selection.modelKey,
    },
  });
  return response;
}

export const Route = createFileRoute("/api/genui")({
  server: {
    handlers: {
      POST: ({ request }: { request: Request }) => handleGenUiRequest(request),
    },
  },
});

