import type { NodeProps } from "@xyflow/react";
import { Settings2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { toast } from "sonner";
import { AutonomySlider, type AutonomyLevel } from "@/components/autonomy-slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { MindscapeNode } from "./mindscape-node";
import { settingsNodeDataSchema } from "@/store/mindscape.schemas";
import { useMindscapeStore } from "@/store/mindscape";
import { trpc, type TRPCAppRouter } from "@/utils/trpc";

const listInput = { limit: 100, offset: 0 } as const;

type PreferenceList = inferRouterOutputs<TRPCAppRouter>["preference"]["list"];
type PreferenceSetInput = inferRouterInputs<TRPCAppRouter>["preference"]["set"];
type PreferenceDeleteInput = inferRouterInputs<TRPCAppRouter>["preference"]["delete"];

export function SettingsNode({ id, data, selected }: NodeProps) {
  const parseResult = settingsNodeDataSchema.safeParse(data);
  const persisted = parseResult.success ? parseResult.data : undefined;

  const [customKey, setCustomKey] = useState("");
  const [customValue, setCustomValue] = useState("");

  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );

  const utils = trpc.useUtils();
  const preferenceQuery = trpc.preference.list.useQuery(listInput);
  const preferences = preferenceQuery.data ?? [];

  const autonomyPreference = useMemo(() => {
    return preferences.find((pref) => pref.key === "autonomy");
  }, [preferences]);

  const currentAutonomy: AutonomyLevel =
    (autonomyPreference?.value as AutonomyLevel) ?? persisted?.autonomy ?? "low";

  const setPreference = trpc.preference.set.useMutation({
    onSuccess: async () => {
      toast.success("Preference saved");
      await utils.preference.list.invalidate(listInput);
    },
    onError: (error) => {
      toast.error(error.message ?? "preference_update_failed");
    },
  });

  const deletePreference = trpc.preference.delete.useMutation({
    onSuccess: async () => {
      toast.success("Preference removed");
      await utils.preference.list.invalidate(listInput);
    },
    onError: (error) => {
      toast.error(error.message ?? "preference_delete_failed");
    },
  });

  const handleAutonomyChange = (level: AutonomyLevel) => {
    const input: PreferenceSetInput = { key: "autonomy", value: level, confidence: 1 };
    setPreference.mutate(input, {
      onSuccess: () => {
        updateArtifactData(id, { autonomy: level });
      },
    });
  };

  const handleCustomSave = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedKey = customKey.trim();
    if (!trimmedKey) {
      toast.error("Preference key required");
      return;
    }
    if (!customValue.trim()) {
      toast.error("Preference value required");
      return;
    }

    let parsedValue: unknown = customValue.trim();
    try {
      parsedValue = JSON.parse(customValue);
    } catch {
      // keep string
    }

    const input: PreferenceSetInput = {
      key: trimmedKey,
      value: parsedValue,
      confidence: 1,
    };

    setPreference.mutate(input, {
      onSuccess: () => {
        setCustomKey("");
        setCustomValue("");
      },
    });
  };

  const handleDelete = (key: string) => {
    const input: PreferenceDeleteInput = { key };
    deletePreference.mutate(input);
  };

  const preferenceItems = useMemo(() => preferences.slice(0, 8), [preferences]);

  return (
    <MindscapeNode
      className="w-[420px] border-slate-500/20 bg-slate-950/10"
      headerActions={<Settings2 className="h-4 w-4 text-slate-200" />}
      id={id}
      selected={selected}
      title="Settings"
    >
      <div className="flex flex-col gap-4 p-4">
        <section className="space-y-3">
          <div className="flex items-center justify-between text-xs text-biolum-faint">
            <span>Autonomy</span>
            <span className="capitalize">{currentAutonomy}</span>
          </div>
          <AutonomySlider
            disabled={setPreference.isPending}
            onChange={handleAutonomyChange}
            value={currentAutonomy}
          />
        </section>

        <section className="space-y-2">
          <p className="text-biolum text-sm font-medium">Custom preference</p>
          <form className="space-y-2" onSubmit={handleCustomSave}>
            <Input
              onChange={(event) => setCustomKey(event.target.value)}
              placeholder="Key"
              value={customKey}
            />
            <Textarea
              onChange={(event) => setCustomValue(event.target.value)}
              placeholder='Value (string or JSON, e.g. "focus_mode")'
              rows={3}
              value={customValue}
            />
            <Button
              className="w-full"
              disabled={setPreference.isPending}
              type="submit"
            >
              {setPreference.isPending ? "Saving…" : "Save preference"}
            </Button>
          </form>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-biolum text-sm font-medium">Stored keys</p>
            <span className="text-biolum-faint text-xs">
              {preferences.length} total
            </span>
          </div>
          <ScrollArea className="h-[180px] rounded-md border border-white/10">
            {preferenceItems.length === 0 ? (
              <p className="p-3 text-center text-sm text-biolum-faint">
                No preferences yet.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {preferenceItems.map((pref) => (
                  <li className="flex items-start justify-between gap-2 p-3" key={pref.id}>
                    <div>
                      <p className="font-medium text-sm text-biolum">{pref.key}</p>
                      <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-biolum-faint">
                        {typeof pref.value === "string"
                          ? pref.value
                          : JSON.stringify(pref.value, null, 2)}
                      </pre>
                    </div>
                    <Button
                      aria-label="Delete preference"
                      disabled={deletePreference.isPending}
                      onClick={() => handleDelete(pref.key)}
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
      </div>
    </MindscapeNode>
  );
}
