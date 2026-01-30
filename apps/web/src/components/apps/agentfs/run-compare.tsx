import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

import type { Workspace } from "./index";

export function RunCompare({
  workspace,
  className,
}: {
  workspace: Workspace;
  className?: string;
}) {
  const { data: listData } = trpc.agentfs.workspacesList.useQuery();
  const workspaces = listData?.workspaces ?? [];

  const choices = useMemo(
    () => workspaces.filter((w) => w.id !== workspace.id),
    [workspaces, workspace.id]
  );

  const [rightId, setRightId] = useState<string>("");

  useEffect(() => {
    setRightId(choices[0]?.id ?? "");
  }, [choices]);

  const right = useMemo(
    () => choices.find((w) => w.id === rightId) ?? null,
    [choices, rightId]
  );

  const {
    data: compareData,
    isLoading,
    error,
  } = trpc.agentfs.compareRuns.useQuery(
    {
      left: { runId: workspace.runId, dbPath: workspace.dbPath },
      right: { runId: right?.runId ?? "", dbPath: right?.dbPath ?? "" },
      limit: 500,
    },
    { enabled: Boolean(right) }
  );

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center gap-3 border-white/5 border-b p-3">
        <div className="flex-1">
          <div className="font-medium text-sm">Compare runs</div>
          <div className="text-biolum-dim text-xs">
            Left: <span className="font-mono">{workspace.runId}</span>
          </div>
        </div>

        <div className="w-80">
          <Select onValueChange={setRightId} value={rightId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a run…" />
            </SelectTrigger>
            <SelectContent>
              {choices.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.runId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!right && (
          <div className="text-biolum-dim text-sm">
            Select another run to compare.
          </div>
        )}
        {right && isLoading && (
          <div className="flex items-center gap-2 text-biolum-dim text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Comparing…
          </div>
        )}
        {right && error && (
          <div className="text-red-400 text-xs">{error.message}</div>
        )}
        {right && compareData && (
          <div className="space-y-6">
            <div className="rounded border border-white/5 bg-white/5 p-3">
              <div className="font-medium text-sm">Summary</div>
              <div className="mt-1 text-biolum-dim text-sm">
                Files: +{compareData.file.added} / -{compareData.file.removed} /
                ~{compareData.file.modified}
                <br />
                KV: +{compareData.kv.added} / -{compareData.kv.removed} / ~
                {compareData.kv.modified}
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium text-biolum-dim text-xs uppercase tracking-wider">
                File diffs (size/mtime)
              </div>
              {compareData.file.diffs.length === 0 ? (
                <div className="text-biolum-dim text-sm">No differences.</div>
              ) : (
                <div className="space-y-1">
                  {compareData.file.diffs.map((d) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded bg-white/5 px-2 py-1"
                      key={`${d.type}:${d.path}`}
                    >
                      <div className="min-w-0 flex-1 truncate font-mono text-xs">
                        {d.type} {d.path}
                      </div>
                      <div className="text-biolum-dim text-xs">
                        {d.left?.size ?? "-"}→{d.right?.size ?? "-"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="font-medium text-biolum-dim text-xs uppercase tracking-wider">
                KV diffs
              </div>
              {compareData.kv.diffs.length === 0 ? (
                <div className="text-biolum-dim text-sm">No differences.</div>
              ) : (
                <div className="space-y-1">
                  {compareData.kv.diffs.map((d) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded bg-white/5 px-2 py-1"
                      key={`${d.type}:${d.key}`}
                    >
                      <div className="min-w-0 flex-1 truncate font-mono text-xs">
                        {d.type} {d.key}
                      </div>
                      <div className="text-biolum-dim text-xs">
                        {(d.left ?? "-").length}→{(d.right ?? "-").length}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
