/**
 * Settings Window Component
 *
 * DOM-based window wrapper for unified settings content.
 */

import type { NodeProps } from "@xyflow/react";
import { Settings2 } from "lucide-react";
import { z } from "zod";
import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";
import { SettingsContent } from "./content";

const settingsWindowDataSchema = z.object({
  type: z.literal("settings"),
  label: z.string().optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
});

export function SettingsWindow({ id, data, selected }: NodeProps) {
  const lod = useLOD();

  const parsed = settingsWindowDataSchema.safeParse(data);
  const windowData = parsed.success
    ? parsed.data
    : { type: "settings" as const, viewMode: "full" as const };

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

  const isCompact = windowData.viewMode === "compact";

  return (
    <WindowFrame
      actions={<Settings2 className="h-4 w-4 text-slate-300" />}
      id={id}
      selected={selected}
      title="Settings"
      width={isCompact ? 380 : 440}
      windowType="settings"
    >
      <div className="p-4">
        <SettingsContent mode={isCompact ? "compact" : "full"} />
      </div>
    </WindowFrame>
  );
}
