/**
 * Mindscape Header Panel
 *
 * Displays the version title at the top center of the canvas.
 */

import { Panel } from "@xyflow/react";

export function HeaderPanel() {
  return (
    <Panel
      className="text-biolum-dim text-xs uppercase tracking-widest"
      position="top-center"
    >
      Symbiotic Mindscape v0.1
    </Panel>
  );
}
