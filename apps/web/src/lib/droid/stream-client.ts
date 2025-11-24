import { toast } from "sonner";
import { createTRPCProxyClient } from "@trpc/client";
import type { AppRouter } from "@alfred/api/routers";
import type { Subscriber } from "@trpc/client";

export type DroidStreamEvent =
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "exit"; code: number }
  | { type: "obligation"; runId: string; obligations: string[] }
  | { type: "resume"; runId: string };

export type DroidStreamOptions = {
  input: {
    prompt: string;
    auto: "read" | "low" | "medium" | "high";
    authz: string;
    out?: "text" | "json" | "debug";
  };
  client: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
  onObligation?: (payload: { runId: string; obligations: string[] }) => void;
  onResume?: (payload: { runId: string }) => void;
};

export function subscribeToDroidStream({
  input,
  client,
  onObligation,
  onResume,
}: DroidStreamOptions) {
  const observable = client.droid.stream.subscribe(input);
  return observable.subscribe({
    next(event) {
      if (event.type === "obligation") {
        try {
          const parsed = JSON.parse(event.data ?? "{}");
          const payload = {
            runId: String(parsed.runId ?? ""),
            obligations: Array.isArray(parsed.obligations)
              ? parsed.obligations.map(String)
              : [],
          };
          onObligation?.(payload);
        } catch (error) {
          console.error("Failed to parse obligation payload", error);
        }
        return;
      }

      if (event.type === "resume") {
        try {
          const payload = JSON.parse(event.data ?? "{}");
          onResume?.({ runId: String(payload.runId ?? "") });
        } catch (error) {
          console.error("Failed to parse resume payload", error);
        }
        return;
      }
    },
    error(err) {
      toast.error(`Droid stream failed: ${err.message ?? String(err)}`);
    },
    complete() {
      // noop
    },
  } as Subscriber<DroidStreamEvent>);
}
