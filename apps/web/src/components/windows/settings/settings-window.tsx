import type { inferRouterInputs } from "@trpc/server";
import type { NodeProps } from "@xyflow/react";
import { Settings2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  type AutonomyLevel,
  AutonomySlider,
} from "@/components/autonomy-slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";
import { useDesktopStore } from "@/store/desktop";
import { type TRPCAppRouter, trpc } from "@/utils/trpc";

const listInput = { limit: 100, offset: 0 } as const;

type PreferenceSetInput = inferRouterInputs<TRPCAppRouter>["preference"]["set"];
type PreferenceDeleteInput =
  inferRouterInputs<TRPCAppRouter>["preference"]["delete"];

const settingsWindowDataSchema = z.object({
  type: z.literal("settings"),
  label: z.string().optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
  autonomy: z.enum(["read", "low", "medium", "high"]).optional(),
});

export function SettingsWindow({ id, data, selected }: NodeProps) {
  const lod = useLOD();

  const parsed = settingsWindowDataSchema.safeParse(data);
  const windowData = parsed.success
    ? parsed.data
    : { type: "settings" as const, viewMode: "full" as const };

  const [customKey, setCustomKey] = useState("");
  const [customValue, setCustomValue] = useState("");
  const updateWindowData = useDesktopStore((s) => s.updateWindowData);

  const utils = trpc.useUtils();
  const preferenceQuery = trpc.preference.list.useQuery(listInput);
  const preferences = preferenceQuery.data ?? [];

  const autonomyPreference = useMemo(
    () => preferences.find((pref) => pref.key === "autonomy"),
    [preferences]
  );

  const currentAutonomy: AutonomyLevel =
    (autonomyPreference?.value as AutonomyLevel) ??
    windowData.autonomy ??
    "low";

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
    const input: PreferenceSetInput = {
      key: "autonomy",
      value: level,
      confidence: 1,
    };
    setPreference.mutate(input, {
      onSuccess: () => {
        updateWindowData(id, { draft: { autonomy: level } });
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

  if (lod === "tiny") {
    return <TinyDot color="bg-slate-500" shadow="shadow-slate-500/50" />;
  }

  if (lod === "small") {
    return (
      <SmallCard
        borderColor="border-slate-500/30"
        hoverColor="hover:border-slate-500/50"
        icon={<Settings2 className="h-3 w-3" />}
        label="Settings"
        textColor="text-slate-300"
      />
    );
  }

  return (
    <WindowFrame
      actions={<Settings2 className="h-4 w-4 text-slate-300" />}
      id={id}
      selected={selected}
      title="Settings"
      width={440}
      windowType="settings"
    >
      <div className="flex flex-col gap-4 p-4">
        <section className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 font-medium text-biolum text-sm">
            Autonomy Level
          </h3>
          <AutonomySlider
            onChange={handleAutonomyChange}
            value={currentAutonomy}
          />
        </section>

        <section className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 font-medium text-biolum text-sm">
            Custom Preference
          </h3>
          <form className="flex flex-col gap-2" onSubmit={handleCustomSave}>
            <Input
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder="key (e.g. theme)"
              value={customKey}
            />
            <Textarea
              className="min-h-[60px]"
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="value (string or JSON)"
              value={customValue}
            />
            <Button
              className="self-end"
              disabled={setPreference.isPending}
              size="sm"
              type="submit"
            >
              Save
            </Button>
          </form>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h3 className="mb-3 font-medium text-biolum text-sm">
            Preferences ({preferences.length})
          </h3>
          <ScrollArea className="h-[140px]">
            {preferenceItems.length === 0 ? (
              <p className="py-4 text-center text-biolum-faint text-xs">
                No preferences yet
              </p>
            ) : (
              <ul className="space-y-1">
                {preferenceItems.map((pref) => (
                  <li
                    className="flex items-center justify-between gap-2 rounded bg-white/5 px-2 py-1 text-xs"
                    key={pref.key}
                  >
                    <span className="font-medium text-white">{pref.key}</span>
                    <span className="max-w-[120px] truncate text-biolum-faint">
                      {typeof pref.value === "string"
                        ? pref.value
                        : JSON.stringify(pref.value)}
                    </span>
                    <Button
                      disabled={deletePreference.isPending}
                      onClick={() => handleDelete(pref.key)}
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </section>
      </div>
    </WindowFrame>
  );
}
