/**
 * Notifications Settings Section (Enhanced)
 *
 * Configure alert preferences with backend persistence.
 */

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/checkbox";
import { DateField } from "@/components/date";
import { DateRangeField, type DateRangeValue } from "@/components/daterange";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { trpc } from "@/utils/trpc";

export function NotificationsSection() {
  const { data: prefs, isLoading } =
    trpc.notification.getPreferences.useQuery();
  const setPrefs = trpc.notification.setPreferences.useMutation();

  const [agentCompletions, setAgentCompletions] = useState(true);
  const [workflowEvents, setWorkflowEvents] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(true);
  const [snoozeUntil, setSnoozeUntil] = useState<Date | undefined>(undefined);
  const [vacation, setVacation] = useState<DateRangeValue>({});

  useEffect(() => {
    if (prefs) {
      setAgentCompletions(prefs.agentCompletions);
      setWorkflowEvents(prefs.workflowEvents);
      setSystemAlerts(prefs.systemAlerts);
      if (prefs.snoozeUntil) {
        setSnoozeUntil(new Date(prefs.snoozeUntil));
      }
      if (prefs.vacationStart || prefs.vacationEnd) {
        setVacation({
          from: prefs.vacationStart ? new Date(prefs.vacationStart) : undefined,
          to: prefs.vacationEnd ? new Date(prefs.vacationEnd) : undefined,
        });
      }
    }
  }, [prefs]);

  const handleSave = () => {
    setPrefs.mutate(
      {
        agentCompletions,
        workflowEvents,
        systemAlerts,
        snoozeUntil: snoozeUntil || null,
        vacationStart: vacation.from ? new Date(vacation.from) : null,
        vacationEnd: vacation.to ? new Date(vacation.to) : null,
      },
      {
        onSuccess: () => toast.success("Notification preferences saved"),
        onError: (error) => toast.error(error.message || "Failed to save"),
      }
    );
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
      <div>
        <h2 className="font-semibold text-lg">Notifications</h2>
        <p className="mt-1 text-biolum-dim text-sm">
          Configure alert preferences and quiet time settings.
        </p>
      </div>

      <div className="space-y-4">
        {[
          {
            id: "completions",
            label: "Agent completions",
            state: agentCompletions,
            setState: setAgentCompletions,
          },
          {
            id: "workflow",
            label: "Workflow events",
            state: workflowEvents,
            setState: setWorkflowEvents,
          },
          {
            id: "alerts",
            label: "System alerts",
            state: systemAlerts,
            setState: setSystemAlerts,
          },
        ].map((setting) => (
          <div
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
            key={setting.id}
          >
            <Label htmlFor={`notify-${setting.id}`}>{setting.label}</Label>
            <Checkbox
              checked={setting.state}
              id={`notify-${setting.id}`}
              onCheckedChange={(checked) => setting.setState(Boolean(checked))}
            />
          </div>
        ))}

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 font-medium">Quiet Time</div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-biolum-dim text-sm">Snooze until</Label>
              <DateField
                onChange={setSnoozeUntil}
                placeholder="Pick a date"
                value={snoozeUntil}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-biolum-dim text-sm">Vacation range</Label>
              <DateRangeField onChange={setVacation} value={vacation} />
            </div>
          </div>
        </div>

        <Button disabled={setPrefs.isPending} onClick={handleSave}>
          {setPrefs.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
