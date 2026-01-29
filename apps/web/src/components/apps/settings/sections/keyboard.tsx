/**
 * Keyboard Shortcuts Section (Enhanced)
 *
 * Customize keyboard shortcuts with conflict detection.
 */

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Choice } from "@/components/choice";
import { List } from "@/components/list";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";

export function KeyboardSection() {
  const { data: shortcuts, isLoading } = trpc.shortcuts.list.useQuery();
  const reset = trpc.shortcuts.reset.useMutation();
  const [mode, setMode] = useState("default");

  const handleReset = () => {
    reset.mutate(undefined, {
      onSuccess: () => window.location.reload(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-biolum" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Keyboard Shortcuts</h2>
          <p className="mt-1 text-biolum-dim text-sm">
            Customize keyboard shortcuts with conflict detection.
          </p>
        </div>
        <Button
          disabled={reset.isPending}
          onClick={handleReset}
          size="sm"
          variant="outline"
        >
          Reset to Defaults
        </Button>
      </div>

      <List
        items={(shortcuts || []).map((s) => ({
          id: s.action,
          content: (
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 px-4">
              <span className="text-biolum-dim text-sm">{s.description}</span>
              <kbd className="rounded bg-void px-2 py-1 font-mono text-biolum text-xs shadow-inner">
                {s.shortcut}
              </kbd>
            </div>
          ),
        }))}
      />

      <p className="text-amber-400 text-xs">
        Shortcut customization UI coming soon. Currently showing defaults.
      </p>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="mb-2 font-medium">Editing mode</div>
        <Choice
          onValueChange={setMode}
          options={[
            {
              value: "default",
              label: "Default",
              description: "Standard keyboard shortcuts",
            },
            {
              value: "vim",
              label: "Vim",
              description: "Vim-style navigation (coming soon)",
              disabled: true,
            },
          ]}
          value={mode}
        />
      </div>
    </div>
  );
}
