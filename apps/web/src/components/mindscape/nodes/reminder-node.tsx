import type { NodeProps } from "@xyflow/react";
import { formatDistanceToNow } from "date-fns";
import { Bell, CalendarClock, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { inferRouterInputs } from "@trpc/server";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MindscapeNode } from "./mindscape-node";
import { reminderNodeDataSchema } from "@/store/mindscape.schemas";
import { useMindscapeStore } from "@/store/mindscape";
import { trpc, type TRPCAppRouter } from "@/utils/trpc";

const REMINDER_LIST_KEY = { limit: 50, offset: 0 } as const;

export function ReminderNode({ id, data, selected }: NodeProps) {
  const result = reminderNodeDataSchema.safeParse(data);
  const parsed = result.success
    ? result.data
    : { title: undefined, due: undefined, description: undefined, mode: "edit" as const };
  const currentStatus = parsed.status ?? deriveStatus(parsed.due, undefined);
  const mode = parsed.mode ?? (parsed.reminderId ? "view" : "edit");
  const isEditing = mode === "edit";

  const [draftTitle, setDraftTitle] = useState(parsed.title ?? "");
  const [draftDescription, setDraftDescription] = useState(parsed.description ?? "");
  const [draftDue, setDraftDue] = useState(
    toLocalInput(parsed.due) ?? defaultDueInput()
  );

  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(parsed.title ?? "");
      setDraftDescription(parsed.description ?? "");
      setDraftDue(toLocalInput(parsed.due) ?? defaultDueInput());
    }
  }, [isEditing, parsed.title, parsed.description, parsed.due]);

  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );
  const removeArtifact = useMindscapeStore((state) => state.removeArtifact);

  const utils = trpc.useUtils();
  type RouterInputs = inferRouterInputs<TRPCAppRouter>;

  const createReminder = trpc.remind.create.useMutation({
    onSuccess: async (reminder) => {
      toast.success("Reminder saved");
      const dueIso = toIsoString(reminder.due);
      updateArtifactData(id, {
        reminderId: reminder.id,
        title: reminder.title,
        description: reminder.description ?? undefined,
        due: dueIso,
        label: reminder.title ?? "Reminder",
        status: deriveStatus(dueIso, reminder.firedAt),
        mode: "view",
      });
      await Promise.all([
        utils.remind.list.invalidate(REMINDER_LIST_KEY),
        utils.remind.due.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to save reminder");
    },
  });

  const deleteReminder = trpc.remind.delete.useMutation({
    onSuccess: async () => {
      toast.success("Reminder deleted");
      removeArtifact(id);
      await Promise.all([
        utils.remind.list.invalidate(REMINDER_LIST_KEY),
        utils.remind.due.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to delete reminder");
    },
  });

  const deleteForReschedule = trpc.remind.delete.useMutation({
    onError: (error) => {
      toast.error(error.message ?? "Failed to discard previous reminder");
    },
  });

  const fireReminder = trpc.remind.fire.useMutation({
    onSuccess: async () => {
      toast.success("Reminder marked complete");
      updateArtifactData(id, { status: "fired" });
      await utils.remind.due.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to complete reminder");
    },
  });

  const isSaving = createReminder.isPending;
  const isDeleting = deleteReminder.isPending;
  const canComplete = parsed.reminderId && currentStatus !== "fired";

  const handleSave = async (event?: React.FormEvent) => {
    event?.preventDefault();

    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle) {
      toast.error("Title is required");
      return;
    }
    if (!draftDue) {
      toast.error("Due date is required");
      return;
    }

    const dueDate = new Date(draftDue);
    if (Number.isNaN(dueDate.getTime())) {
      toast.error("Invalid due date");
      return;
    }

    const input: RouterInputs["remind"]["create"] = {
      title: trimmedTitle,
      due: dueDate.toISOString(),
      description: draftDescription.trim() || undefined,
    };

    try {
      await createReminder.mutateAsync(input);
      if (parsed.reminderId) {
        await deleteForReschedule.mutateAsync({ id: parsed.reminderId });
      }
    } catch (error) {
      // Errors handled by mutation hooks
    }
  };

  const handleDelete = () => {
    if (!parsed.reminderId) {
      removeArtifact(id);
      return;
    }
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete this reminder?");
      if (!confirmed) return;
    }
    deleteReminder.mutate({ id: parsed.reminderId });
  };

  const handleComplete = () => {
    if (!parsed.reminderId || fireReminder.isPending) {
      return;
    }
    fireReminder.mutate({ id: parsed.reminderId });
  };

  const enterEditMode = () => {
    updateArtifactData(id, { mode: "edit" });
  };

  const statusBadge = getStatusBadge(currentStatus);
  const relativeDue = useMemo(() => {
    if (!parsed.due) return "No due date";
    const dueDate = new Date(parsed.due);
    if (Number.isNaN(dueDate.getTime())) return parsed.due;
    return `Due ${formatDistanceToNow(dueDate, { addSuffix: true })}`;
  }, [parsed.due]);

  const absoluteDue = useMemo(() => {
    if (!parsed.due) return null;
    const dueDate = new Date(parsed.due);
    if (Number.isNaN(dueDate.getTime())) return parsed.due;
    return dueDate.toLocaleString();
  }, [parsed.due]);

  return (
    <MindscapeNode
      className="w-[320px] border-blue-500/20 bg-blue-950/10"
      headerActions={<Bell className="h-4 w-4 text-blue-400" />}
      id={id}
      selected={selected}
      title={parsed.title?.trim() || "Reminder"}
    >
      <div className="flex flex-col gap-3 p-4">
        {isEditing ? (
          <form className="flex flex-col gap-3" onSubmit={handleSave}>
            <Input
              autoFocus
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="Reminder title"
              value={draftTitle}
            />
            <input
              className="rounded-md border border-input bg-background p-2 text-sm"
              onChange={(event) => setDraftDue(event.target.value)}
              type="datetime-local"
              value={draftDue}
            />
            <Textarea
              onChange={(event) => setDraftDescription(event.target.value)}
              placeholder="Description (optional)"
              rows={3}
              value={draftDescription}
            />
            <div className="flex items-center justify-between">
              <Button
                className="text-red-400"
                disabled={isDeleting}
                onClick={handleDelete}
                size="sm"
                type="button"
                variant="ghost"
              >
                {parsed.reminderId ? "Delete" : "Discard"}
              </Button>
              <Button disabled={isSaving} size="sm" type="submit">
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving
                  </span>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
              {absoluteDue && (
                <span className="text-biolum-faint text-xs">{absoluteDue}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-biolum">
              <CalendarClock className="h-4 w-4 text-blue-300" />
              <span>{relativeDue}</span>
            </div>
            {parsed.description ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {parsed.description}
              </p>
            ) : (
              <p className="text-sm italic text-biolum-faint">No description</p>
            )}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  disabled={!canComplete || fireReminder.isPending}
                  onClick={handleComplete}
                  size="sm"
                  variant="secondary"
                >
                  {fireReminder.isPending ? "Completing…" : "Complete"}
                </Button>
                <Button onClick={enterEditMode} size="sm" variant="ghost">
                  Reschedule
                </Button>
              </div>
              <Button
                className="text-red-400"
                disabled={isDeleting}
                onClick={handleDelete}
                size="icon"
                variant="ghost"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </MindscapeNode>
  );
}

function deriveStatus(dueIso?: string, firedAt?: Date | string | null) {
  if (firedAt) return "fired" as const;
  if (!dueIso) return "scheduled" as const;
  const due = new Date(dueIso);
  if (Number.isNaN(due.getTime())) return "scheduled" as const;
  return due.getTime() <= Date.now() ? "due" : "scheduled";
}

function toLocalInput(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return formatForInput(date);
}

function defaultDueInput() {
  const date = new Date(Date.now() + 5 * 60 * 1000);
  return formatForInput(date);
}

function formatForInput(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoString(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

const STATUS_STYLES = {
  scheduled: {
    className: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    label: "Scheduled",
  },
  due: {
    className: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    label: "Due",
  },
  fired: {
    className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    label: "Completed",
  },
} as const;

function getStatusBadge(status: "scheduled" | "due" | "fired") {
  return STATUS_STYLES[status];
}
