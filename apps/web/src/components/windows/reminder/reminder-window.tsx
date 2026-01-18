import { useLiveQuery } from "@tanstack/react-db";
import { useStore } from "@tanstack/react-form";
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
import { useAppForm, useSubmitInvalidFocus } from "@/form";
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
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateWindowData = useDesktopStore((s) => s.updateWindowData);
  const removeWindow = useDesktopStore((s) => s.removeWindow);

  const { ref, onSubmitInvalid } = useSubmitInvalidFocus();
  const form = useAppForm({
    defaultValues: {
      title: reminder?.title ?? "",
      description: reminder?.description ?? "",
      due: toLocalInput(reminder?.due) || defaultDueInput(),
    },
    onSubmitInvalid,
    validators: {
      onSubmit: z.object({
        title: z.string().refine((value) => value.trim().length > 0, {
          message: "Title is required",
        }),
        description: z.string(),
        due: z
          .string()
          .refine((value) => value.trim().length > 0, {
            message: "Due date is required",
          })
          .refine((value) => !Number.isNaN(new Date(value).getTime()), {
            message: "Invalid due date",
          }),
      }),
    },
    onSubmit: ({ value }) => {
      const dueDate = new Date(value.due);
      if (Number.isNaN(dueDate.getTime())) {
        toast.error("Invalid due date");
        return;
      }

      setIsSaving(true);
      try {
        if (isNew) {
          const newId = crypto.randomUUID();
          insertReminder({
            title: value.title.trim(),
            description: value.description.trim() || undefined,
            due: dueDate.toISOString(),
          });
          updateWindowData(id, {
            resourceRef: { type: "reminder", id: newId },
            label: value.title.trim(),
          });
          toast.success("Reminder created");
        } else if (resourceId) {
          deleteReminder(resourceId);
          insertReminder({
            title: value.title.trim(),
            description: value.description.trim() || undefined,
            due: dueDate.toISOString(),
          });
          updateWindowData(id, {
            label: value.title.trim(),
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
  });

  const values = useStore(form.store, (state) => state.values);

  useEffect(() => {
    if (reminder && mode === "view") {
      form.reset({
        title: reminder.title ?? "",
        description: reminder.description ?? "",
        due: toLocalInput(reminder.due) || defaultDueInput(),
      });
    }
  }, [form, reminder, mode]);

  useEffect(() => {
    if (isNew) {
      setMode("edit");
    }
  }, [isNew]);

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
    form.reset({
      title: reminder?.title ?? "",
      description: reminder?.description ?? "",
      due: toLocalInput(reminder?.due) || defaultDueInput(),
    });
    setMode("view");
  }, [form, id, isNew, reminder, removeWindow]);

  const enterEditMode = useCallback(() => {
    form.reset({
      title: reminder?.title ?? "",
      description: reminder?.description ?? "",
      due: toLocalInput(reminder?.due) || defaultDueInput(),
    });
    setMode("edit");
  }, [form, reminder?.description, reminder?.due, reminder?.title]);

  const displayTitle =
    reminder?.title?.trim() || values.title.trim() || "Reminder";

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
          <form.AppForm>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void form.handleSubmit();
              }}
              ref={ref}
            >
              <form.AppField name="title">
                {(field) => (
                  <Input
                    aria-invalid={field.state.meta.errors.length > 0}
                    autoFocus
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Reminder title"
                    value={field.state.value}
                  />
                )}
              </form.AppField>
              <form.AppField name="description">
                {(field) => (
                  <Textarea
                    className="min-h-[80px]"
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Description (optional)"
                    value={field.state.value}
                  />
                )}
              </form.AppField>
              <form.AppField name="due">
                {(field) => (
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-biolum-dim" />
                    <Input
                      aria-invalid={field.state.meta.errors.length > 0}
                      className="flex-1"
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      type="datetime-local"
                      value={field.state.value}
                    />
                  </div>
                )}
              </form.AppField>
              <form.Subscribe selector={(state) => state.errorMap}>
                {(errorMap) =>
                  errorMap.onSubmit?.title || errorMap.onSubmit?.due ? (
                    <p className="text-destructive text-sm">
                      {String(errorMap.onSubmit.title ?? errorMap.onSubmit.due)}
                    </p>
                  ) : null
                }
              </form.Subscribe>
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
          </form.AppForm>
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
