"use client";

import type { ReactNode } from "react";
import { DesktopCanvas } from "./canvas";
import { Dock } from "./dock";

type DesktopProps = {
  children?: ReactNode;
  onWorkflowNavigate?: (runId: string) => void;
};

export function Desktop({ children, onWorkflowNavigate }: DesktopProps) {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-void">
      <DesktopCanvas onWorkflowNavigate={onWorkflowNavigate}>
        <Dock />
        {children}
      </DesktopCanvas>
    </div>
  );
}
