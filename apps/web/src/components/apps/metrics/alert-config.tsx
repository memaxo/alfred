/**
 * Alert Config - Configure metric alerts
 */

import { Bell, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BiometricGate, isBiometricError } from "@/components/admin/gate";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

export function AlertConfig() {
  const utils = trpc.useUtils();
  const { data, error, isLoading, refetch } = trpc.admin.alertsList.useQuery(
    undefined,
    {
      retry: false,
    }
  );

  const createMutation = trpc.admin.alertsCreate.useMutation({
    onSuccess: () => {
      toast.success("Alert rule created");
      utils.admin.alertsList.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to create alert");
    },
  });

  const toggleMutation = trpc.admin.alertsToggle.useMutation({
    onSuccess: () => {
      utils.admin.alertsList.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to toggle alert");
    },
  });

  const deleteMutation = trpc.admin.alertsDelete.useMutation({
    onSuccess: () => {
      toast.success("Alert rule deleted");
      utils.admin.alertsList.invalidate();
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to delete alert");
    },
  });

  if (isBiometricError(error)) {
    return (
      <div className="p-4">
        <BiometricGate onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const alerts = data?.alerts ?? [];

  const handleCreate = () => {
    const name = window.prompt("Alert Name:");
    if (!name) {
      return;
    }
    const query = window.prompt("PromQL Query:");
    if (!query) {
      return;
    }
    const condition = window.prompt("Condition (e.g. > 0.1):");
    if (!condition) {
      return;
    }

    createMutation.mutate({
      name,
      query,
      condition,
      severity: "warning",
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Delete this alert rule?")) {
      deleteMutation.mutate({ alertId: id });
    }
  };

  const handleToggle = (id: string, enabled: boolean) => {
    toggleMutation.mutate({ alertId: id, enabled: !enabled });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-white/5 border-b p-4">
        <span className="font-medium text-sm">Alert Rules</span>
        <Button
          className="gap-1"
          disabled={createMutation.isPending}
          onClick={handleCreate}
          size="sm"
        >
          <Plus className="h-3 w-3" />
          New Alert
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          {alerts.length === 0 && (
            <div className="rounded-lg border border-white/5 border-dashed p-8 text-center text-biolum-dim text-sm">
              No alert rules configured.
            </div>
          )}
          {alerts.map((alert) => (
            <div
              className={cn(
                "rounded-lg border p-3 transition-colors",
                alert.enabled
                  ? "border-white/10 bg-white/5"
                  : "border-white/5 bg-white/5 opacity-50"
              )}
              key={alert.id}
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Bell
                    className={cn(
                      "h-4 w-4",
                      alert.severity === "critical"
                        ? "text-red-400"
                        : alert.severity === "warning"
                          ? "text-yellow-400"
                          : "text-biolum"
                    )}
                  />
                  <span className="font-medium text-sm">{alert.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] uppercase tracking-wider",
                      alert.severity === "critical"
                        ? "bg-red-500/20 text-red-400"
                        : alert.severity === "warning"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-biolum/20 text-biolum"
                    )}
                  >
                    {alert.severity}
                  </span>
                  <Button
                    className="h-6 w-6 text-red-400/50 hover:bg-red-500/10 hover:text-red-400"
                    disabled={deleteMutation.isPending}
                    onClick={() => handleDelete(alert.id)}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="font-mono text-[10px] text-biolum-dim">
                  {alert.query}
                </div>
                <div className="text-biolum text-xs">
                  Condition:{" "}
                  <span className="font-mono text-biolum-bright">
                    {alert.condition}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-white/5 border-t pt-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs transition-opacity hover:opacity-80">
                  <input
                    checked={alert.enabled}
                    className="accent-biolum"
                    disabled={toggleMutation.isPending}
                    onChange={() => handleToggle(alert.id, alert.enabled)}
                    type="checkbox"
                  />
                  <span className="text-biolum-dim">Enabled</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
