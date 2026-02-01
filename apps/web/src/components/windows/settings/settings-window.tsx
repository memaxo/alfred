/**
 * Settings Window Component
 *
 * DOM-based window wrapper for unified settings app.
 * Now uses the consolidated desktop settings app instead of legacy content components.
 */

import type { NodeProps } from "@xyflow/react";

import { Settings2 } from "lucide-react";
import { z } from "zod";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { SettingsApp } from "@/components/apps/settings";
import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";

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

  // Mock WindowComponentProps for SettingsApp
  const now = Date.now();
  const windowInstance: WindowComponentProps["window"] = {
    id,
    type: "settings",
    data: {
      type: "settings",
      label: windowData.label,
      viewMode: windowData.viewMode,
    },
    workspaceId: 1,
    bounds: {
      x: 0,
      y: 0,
      width: isCompact ? 600 : 800,
      height: 600,
    },
    state: "normal",
    isTiled: false,
    zIndex: 0,
    isFocused: Boolean(selected),
    minSize: { width: 400, height: 300 },
    resizable: true,
    createdAt: now,
    lastFocusedAt: now,
  };

  const onDragStart: WindowComponentProps["onDragStart"] = () => {};
  const onDragEnd: WindowComponentProps["onDragEnd"] = () => {};
  const onResizeStart: WindowComponentProps["onResizeStart"] = () => {};
  const onResizeEnd: WindowComponentProps["onResizeEnd"] = () => {};

  const mockProps: WindowComponentProps = {
    window: windowInstance,
    onClose: () => {},
    onMinimize: () => {},
    onMaximize: () => {},
    onRestore: () => {},
    onFocus: () => {},
    onBlur: () => {},
    onDragStart,
    onDragEnd,
    onResizeStart,
    onResizeEnd,
    onDataChange: () => {},
  };

  return (
    <WindowFrame
      actions={<Settings2 className="h-4 w-4 text-slate-300" />}
      id={id}
      selected={selected}
      title="Settings"
      width={isCompact ? 600 : 800}
      windowType="settings"
    >
      <SettingsApp {...mockProps} />
    </WindowFrame>
  );
}
