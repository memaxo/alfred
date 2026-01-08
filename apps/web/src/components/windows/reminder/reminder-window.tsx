import { useLiveQuery } from "@tanstack/react-db";
import type { NodeProps } from "@xyflow/react";
import { formatDistanceToNow } from "date-fns";
import { Bell, CalendarClock, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useReminderCollection } from "@/collections";
import type { ReminderResource } from "@/collections/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";
import { useDesktopStore } from "@/store/desktop";

const reminderWindowDataSchema = z.object({
  type: z.literal("reminder"),
  label: z.string().optional(),
  resourceRef: z
    .object({
      type: z.literal("reminder"),
      id: z.string(),
    })
    .optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
  draft: z.unknown().optional(),
});

function toLocalInput(isoString?: string | null): string {
  if (!isoString) {
    return "";
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function defaultDueInput(): string {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return toLocalInput(date.toISOString());
}

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-500",
  due: "bg-yellow-500/10 text-yellow-500",
  fired: "bg-green-500/10 text-green-500",
};

export function ReminderWindow({ id, data, selected }: NodeProps) {
  const parsed = reminderWindowDataSchema.safeParse(data);
  const windowData = parsed.success
    ? parsed.data
    : { type: "reminder" as const, viewMode: "full" as const };

  const lod = useLOD();
  const { collection, insertReminder, fireReminder, deleteReminder } =
    useReminderCollection();

  const resourceId = windowData.resourceRef?.id;

  const { data: reminders, isLoading } = useLiveQuery(
    (q) =>
      q
        .from({ reminder: collection })
        .where(({ reminder }) =>
          resourceId ? reminder.id === resourceId : false
        )
        .select(({ reminder }) => reminder),
    [resourceId, collection]
  );

  const reminder = reminders?.[0] as ReminderResource | undefined;
  const isNew = !resourceId;
  const currentStatus = reminder?.status ?? "scheduled";

  const [mode, setMode] = useState<"view" | "edit">(isNew ? "edit" : "view");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftDue, setDraftDue] = useState(defaultDueInput());
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateWindowData = useDesktopStore((s) => s.updateWindowData);
  const removeWindow = useDesktopStore((s) => s.removeWindow);

  useEffect(() => {
    if (reminder && mode === "view") {
      setDraftTitle(reminder.title ?? "");
      setDraftDescription(reminder.description ?? "");
      setDraftDue(toLocalInput(reminder.due) || defaultDueInput());
    }
  }, [reminder, mode]);

  useEffect(() => {
    if (isNew) {
      setMode("edit");
    }
  }, [isNew]);

  const handleSave = useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault();

      if (!draftTitle.trim()) {
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

      setIsSaving(true);
      try {
        if (isNew) {
          const newId = crypto.randomUUID();
          insertReminder({
            title: draftTitle.trim(),
            description: draftDescription.trim() || undefined,
            due: dueDate.toISOString(),
          });
          updateWindowData(id, {
            resourceRef: { type: "reminder", id: newId },
            label: draftTitle.trim(),
          });
          toast.success("Reminder created");
        } else if (resourceId) {
          deleteReminder(resourceId);
          insertReminder({
            title: draftTitle.trim(),
            description: draftDescription.trim() || undefined,
            due: dueDate.toISOString(),
          });
          updateWindowData(id, {
            label: draftTitle.trim(),
          });
          toast.success("Reminder updated");
        }
        setMode("view");
      } catch {
        toast.error("Failed to save reminder");
      } finally {
        setIsSaving(false);
      }
    },
    [
      draftDescription,
      draftDue,
      draftTitle,
      id,
      insertReminder,
      deleteReminder,
      isNew,
      resourceId,
      updateWindowData,
    ]
  );

  const handleDelete = useCallback(() => {
    if (isNew) {
      removeWindow(id);
      return;
    }

    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete this reminder?");
      if (!confirmed) {
        return;
      }
    }

    setIsDeleting(true);
    try {
      if (resourceId) {
        deleteReminder(resourceId);
      }
      removeWindow(id);
      toast.success("Reminder deleted");
    } catch (_error) {
      toast.error("Failed to delete reminder");
      setIsDeleting(false);
    }
  }, [deleteReminder, id, isNew, removeWindow, resourceId]);

  const handleFire = useCallback(() => {
    if (resourceId) {
      fireReminder(resourceId);
      toast.success("Reminder marked as complete");
    }
  }, [fireReminder, resourceId]);

  const handleCancel = useCallback(() => {
    if (isNew) {
      removeWindow(id);
      return;
    }
    setDraftTitle(reminder?.title ?? "");
    setDraftDescription(reminder?.description ?? "");
    setDraftDue(toLocalInput(reminder?.due) || defaultDueInput());
    setMode("view");
  }, [id, isNew, reminder, removeWindow]);

  const enterEditMode = useCallback(() => {
    setMode("edit");
  }, []);

  const displayTitle =
    reminder?.title?.trim() || draftTitle.trim() || "Reminder";

  const dueLabel = useMemo(() => {
    const dueStr = reminder?.due;
    if (!dueStr) {
      return null;
    }
    const date = new Date(dueStr);
    if (Number.isNaN(date.getTime())) {
      return dueStr;
    }
    return formatDistanceToNow(date, { addSuffix: true });
  }, [reminder?.due]);

  if (lod === "tiny") {
    return <TinyDot color="bg-purple-500" shadow="shadow-purple-500/50" />;
  }

  if (lod === "small") {
    return (
      <SmallCard
        borderColor="border-purple-500/20"
        hoverColor="hover:border-purple-500/40"
        icon={<Bell className="h-3 w-3" />}
        label={displayTitle}
        textColor="text-purple-500"
      />
    );
  }

  const headerIcon = <Bell className="h-4 w-4 text-purple-500" />;

  return (
    <WindowFrame
      actions={headerIcon}
      id={id}
      selected={selected}
      title={displayTitle}
      windowType="reminder"
    >
      <div className="flex flex-col gap-3 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-biolum-dim" />
          </div>
        ) : mode === "edit" ? (
          <form className="flex flex-col gap-3" onSubmit={handleSave}>
            <Input
              autoFocus
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Reminder title"
              value={draftTitle}
            />
            <Textarea
              className="min-h-[80px]"
              onChange={(e) => setDraftDescription(e.target.value)}
              placeholder="Description (optional)"
              value={draftDescription}
            />
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-biolum-dim" />
              <Input
                className="flex-1"
                onChange={(e) => setDraftDue(e.target.value)}
                type="datetime-local"
                value={draftDue}
              />
            </div>
            <div className="flex items-center justify-between">
              <Button
                className="text-red-500"
                disabled={isDeleting}
                onClick={handleDelete}
                size="sm"
                type="button"
                variant="ghost"
              >
                {isNew ? "Discard" : "Delete"}
              </Button>
              <div className="flex gap-2">
                <Button
                  onClick={handleCancel}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Cancel
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
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Badge
                className={statusColors[currentStatus]}
                variant="secondary"
              >
                {currentStatus}
              </Badge>
              {dueLabel && (
                <span className="text-biolum-faint text-xs">{dueLabel}</span>
              )}
            </div>
            {reminder?.description && (
              <p className="text-muted-foreground text-sm">
                {reminder.description}
              </p>
            )}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button onClick={enterEditMode} size="sm" variant="secondary">
                  Edit
                </Button>
                {currentStatus !== "fired" && (
                  <Button onClick={handleFire} size="sm" variant="outline">
                    Mark Done
                  </Button>
                )}
              </div>
              {resourceId && (
                <Button
                  className="text-red-500"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </WindowFrame>
  );
}
