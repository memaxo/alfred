/**
 * Storage Monitor Component
 *
 * Displays localStorage usage for desktop layout.
 * Only visible in development mode.
 */

import { useEffect, useState } from "react";

import { getLayoutStorageSize } from "@/lib/desktop/performance";

interface StorageInfo {
  kb: number;
  percentUsed: number;
  withinBudget: boolean;
}

/**
 * Monitor localStorage size for desktop layout.
 * Only renders in development mode.
 */
export function StorageMonitor() {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (!isDev) {
      return;
    }

    const update = () => {
      const { kb, percentUsed, withinBudget } = getLayoutStorageSize();
      setInfo({ kb, percentUsed, withinBudget });
    };

    update();

    // Update on storage changes
    window.addEventListener("storage", update);
    // Update periodically
    const interval = setInterval(update, 5000);

    return () => {
      window.removeEventListener("storage", update);
      clearInterval(interval);
    };
  }, [isDev]);

  if (!(isDev && info)) {
    return null;
  }

  return (
    <div
      className={`fixed right-2 bottom-2 rounded px-2 py-1 font-mono text-xs ${
        info.withinBudget
          ? "bg-green-900/80 text-green-200"
          : "bg-red-900/80 text-red-200"
      }`}
    >
      Storage: {info.kb.toFixed(1)}KB / 50KB ({info.percentUsed.toFixed(0)}%)
    </div>
  );
}
