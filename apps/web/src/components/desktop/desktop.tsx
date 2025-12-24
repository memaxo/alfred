"use client";

import type { ReactNode } from "react";
import { DesktopCanvas } from "./canvas";
import { DesktopCommandPalette } from "./command-palette";
import { Dock } from "./dock";
import { StorageMonitor } from "./storage-monitor";

type DesktopProps = {
  children?: ReactNode;
  onWorkflowNavigate?: (runId: string) => void;
  onVisualize?: (windowId: string) => void;
  onAsk?: (windowId: string, label?: string) => void;
};

export function Desktop({
  children,
  onWorkflowNavigate,
  onVisualize,
  onAsk,
}: DesktopProps) {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-void">
      <DesktopCanvas onWorkflowNavigate={onWorkflowNavigate}>
        <Dock />
        {children}
      </DesktopCanvas>
      <DesktopCommandPalette onAsk={onAsk} onVisualize={onVisualize} />
      <StorageMonitor />
    </div>
  );
}
