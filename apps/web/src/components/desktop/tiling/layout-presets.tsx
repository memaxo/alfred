"use client";

import {
  Box,
  Columns,
  LayoutGrid,
  SplitSquareHorizontal,
  SplitSquareVertical,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import type { TilingLayout } from "@/store/desktop/types.new";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";

const LAYOUTS: {
  id: TilingLayout;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    id: "float",
    label: "Float",
    icon: <Box className="h-4 w-4" />,
    description: "Traditional floating windows",
  },
  {
    id: "split-h",
    label: "Split Horizontal",
    icon: <SplitSquareHorizontal className="h-4 w-4" />,
    description: "50/50 horizontal split",
  },
  {
    id: "split-v",
    label: "Split Vertical",
    icon: <SplitSquareVertical className="h-4 w-4" />,
    description: "50/50 vertical split",
  },
  {
    id: "quad",
    label: "Quad",
    icon: <LayoutGrid className="h-4 w-4" />,
    description: "Four-quadrant layout",
  },
  {
    id: "main-side",
    label: "Main + Side",
    icon: <Columns className="h-4 w-4" />,
    description: "Main window with sidebar",
  },
  {
    id: "columns",
    label: "Columns",
    icon: <Columns className="h-4 w-4" />,
    description: "Three equal columns",
  },
];

interface LayoutPresetsProps {
  className?: string;
}

export function LayoutPresets({ className }: LayoutPresetsProps) {
  const { config, setLayout, autoTile } = useDesktopStore(
    useShallow((s) => ({
      config: s.config,
      setLayout: s.setLayout,
      autoTile: s.autoTile,
    }))
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-2">
        <span className="font-medium text-biolum-dim text-xs uppercase tracking-wider">
          Layout Presets
        </span>
        <div className="grid grid-cols-2 gap-2">
          {LAYOUTS.map((layout) => (
            <Button
              className={cn(
                "flex h-auto flex-col items-start gap-1 px-3 py-2",
                config.layout === layout.id
                  ? "border-biolum/30 bg-biolum/10 text-biolum"
                  : "border-white/10 hover:bg-white/5"
              )}
              key={layout.id}
              onClick={() => setLayout(layout.id)}
              size="sm"
              variant={config.layout === layout.id ? "default" : "outline"}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-xs">{layout.label}</span>
                {layout.icon}
              </div>
              <span className="text-[10px] text-biolum-dim/70">
                {layout.description}
              </span>
            </Button>
          ))}
        </div>
      </div>

      <Button
        className="border-white/10 hover:bg-white/5"
        onClick={autoTile}
        size="sm"
        variant="outline"
      >
        Auto-tile Windows
      </Button>
    </div>
  );
}
