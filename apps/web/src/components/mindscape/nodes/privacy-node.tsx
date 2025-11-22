import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { NodeProps } from "@xyflow/react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { PrivacyControls } from "@/components/privacy-controls";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMindscapeStore } from "@/store/mindscape";
import { privacyNodeDataSchema } from "@/store/mindscape.schemas";
import { type TRPCAppRouter, trpc } from "@/utils/trpc";
import { MindscapeNode } from "./mindscape-node";
import { useLOD, useNodeFocus } from "../lod";

const factInput = { limit: 12, offset: 0 } as const;
const eventInput = { limit: 12, offset: 0 } as const;

type DeleteFactInput =
  inferRouterInputs<TRPCAppRouter>["privacy"]["deleteFact"];
type FactList = inferRouterOutputs<TRPCAppRouter>["privacy"]["facts"];

export function PrivacyNode({ id, data, selected }: NodeProps) {
  const lod = useLOD();
  useNodeFocus(id);

  const _parsed = privacyNodeDataSchema.safeParse(data);
  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );

  // ... queries ...
  const utils = trpc.useUtils();
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
    (idToDelete: string) => {
      const input: DeleteFactInput = { id: idToDelete };
      deleteFact.mutate(input);
    },
    [deleteFact]
  );

  const handleExport = () => {
    const payload = {
      facts,
      events,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `alfred-export-${new Date().toISOString().split("T")[0]}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    updateArtifactData(id, { lastExportedAt: new Date().toISOString() });
  };

  const handleForget = () => {
    for (const fact of facts) {
      const input: DeleteFactInput = { id: fact.id };
      deleteFact.mutate(input);
    }
  };

  const eventsToShow = useMemo(() => events.slice(0, 5), [events]);

  // LOD 0: Tiny
  if (lod === "tiny") {
    return (
      <div className="flex h-3 w-3 items-center justify-center rounded-full bg-rose-500/40 backdrop-blur-sm">
        <div className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
      </div>
    );
  }

  // LOD 1: Small
  if (lod === "small") {
    return (
      <div className="flex items-center gap-2 rounded-full border border-rose-500/30 bg-void-surface/40 px-3 py-1 backdrop-blur-md transition-colors hover:border-rose-500/50">
        <ShieldCheck className="h-3 w-3 text-rose-400" />
        <span className="font-medium text-[10px] text-rose-300 tracking-tight">
          Privacy
        </span>
      </div>
    );
  }

  return (
    <MindscapeNode
      className="w-[420px] border-rose-500/20 bg-rose-950/10"
      headerActions={<ShieldCheck className="h-4 w-4 text-rose-200" />}
      id={id}
      selected={selected}
      title="Privacy"
    >
      <div className="flex flex-col gap-4 p-4">
        <PrivacyControls
          exportDisabled={factQuery.isLoading || eventQuery.isLoading}
          forgetDisabled={deleteFact.isPending || facts.length === 0}
          onExport={handleExport}
          onForget={handleForget}
        />

        <section className="space-y-2">
          <p className="font-medium text-biolum text-sm">Stored facts</p>
          <ScrollArea className="h-[160px] rounded-md border border-white/10">
            {factQuery.isLoading ? (
              <p className="p-3 text-center text-biolum-faint text-sm">
                Loading facts…
              </p>
            ) : facts.length === 0 ? (
              <p className="p-3 text-center text-biolum-faint text-sm">
                No stored facts.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {facts.map((fact) => (
                  <li
                    className="flex items-start justify-between gap-2 p-3"
                    key={fact.id}
                  >
                    <div>
                      <p className="text-biolum-faint text-xs">
                        {fact.created ?? fact.updated ?? ""}
                      </p>
                      <p className="text-sm">{fact.content}</p>
                      <p className="text-biolum-faint text-xs">
                        {fact.category ?? "general"} • confidence{" "}
                        {fact.confidence ?? 1}
                      </p>
                    </div>
                    <Button
                      aria-label="Delete fact"
                      disabled={deleteFact.isPending}
                      onClick={() => handleDelete(fact.id)}
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </section>

        <section className="space-y-2">
          <p className="font-medium text-biolum text-sm">Recent events</p>
          <ScrollArea className="h-[140px] rounded-md border border-white/10">
            {eventQuery.isLoading ? (
              <p className="p-3 text-center text-biolum-faint text-sm">
                Loading events…
              </p>
            ) : eventsToShow.length === 0 ? (
              <p className="p-3 text-center text-biolum-faint text-sm">
                No events recorded.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {eventsToShow.map((event) => (
                  <li className="space-y-1 p-3" key={event.id}>
                    <div className="flex items-center justify-between text-biolum-faint text-xs">
                      <span>{event.type}</span>
                      <span>
                        {event.timestamp
                          ? new Date(event.timestamp).toLocaleString()
                          : ""}
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap break-words text-[11px] text-biolum-faint">
                      {JSON.stringify(event.data, null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </section>
      </div>
    </MindscapeNode>
  );
}
