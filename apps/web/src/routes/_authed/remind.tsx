import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RemindPane, type RemindPaneItem } from "@alfred/ui";
import { RouteError } from "@/components/route-error";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaneLayout } from "@/components/pane-layout";
import type { TRPCAppRouter } from "@/utils/trpc";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_authed/remind")({
  component: RemindRoute,
  errorComponent: RouteError,
});

function RemindRoute() {
  const utils = trpc.useUtils();
  const [defaultDue, setDefaultDue] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");
  const listInput = useMemo(() => ({ limit: 50, offset: 0 }), []);
  const [dueBefore, setDueBefore] = useState(() => {
    if (typeof window === "undefined") {
      return new Date(0).toISOString();
    }
    return new Date().toISOString();
  });
  const dueInput = useMemo(() => ({ before: dueBefore }), [dueBefore]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const start = new Date(Date.now() + 5 * 60 * 1000);
      const defaultDueValue = start.toISOString().slice(0, 16);
      setDefaultDue(defaultDueValue);
      setDue(defaultDueValue);
    }
  }, []);

  type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
  type RouterInputs = inferRouterInputs<TRPCAppRouter>;
  type CreateReminderInput = RouterInputs["remind"]["create"];
  type DeleteReminderInput = RouterInputs["remind"]["delete"];
  type ReminderItem = RouterOutputs["remind"]["list"][number];
  type DueReminderItem = RouterOutputs["remind"]["due"][number];

  const reminderListQuery = trpc.remind.list.useQuery(listInput);
  const dueRemindersQuery = trpc.remind.due.useQuery(dueInput, {
    staleTime: 5000,
  });

  const reminders: ReminderItem[] = reminderListQuery.data ?? [];
  const dueSoon: DueReminderItem[] = dueRemindersQuery.data ?? [];
  const isReminderLoading = reminderListQuery.isLoading;
  const isDueLoading = dueRemindersQuery.isLoading;

  const refreshDue = useCallback(async () => {
    const next = new Date().toISOString();
    setDueBefore(next);
    await utils.remind.due.invalidate({ before: next });
  }, [utils]);

  const createReminder = trpc.remind.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.remind.list.invalidate(listInput),
        refreshDue(),
      ]);
      setTitle("");
      setDescription("");
      setDue(defaultDue);
    },
  });

  const deleteReminder = trpc.remind.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.remind.list.invalidate(listInput),
        refreshDue(),
      ]);
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!(title.trim() && due)) {
      return;
    }
    const dueIso = new Date(due).toISOString();
    const input: CreateReminderInput = {
      title: title.trim(),
      due: dueIso,
      description: description.trim() || undefined,
    };
    createReminder.mutate(input);
  };

  const handleDelete = (id: string) => {
    const input: DeleteReminderInput = { id };
    deleteReminder.mutate(input);
  };

  const paneItems: RemindPaneItem[] = useMemo(
    () =>
      reminders.map((reminder) => ({
        id: reminder.id,
        title: reminder.title,
        dueAt: reminder.due,
        description: reminder.description ?? null,
      })),
    [reminders]
  );

  const createForm = (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              disabled={createReminder.isPending}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Reminder title"
              value={title}
            />
            <input
              className="w-full rounded-md border border-input bg-background p-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={createReminder.isPending}
              onChange={(event) => setDue(event.target.value)}
              type="datetime-local"
              value={due}
            />
            <textarea
              className="w-full rounded-md border border-input bg-background p-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={createReminder.isPending}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description (optional)"
              rows={3}
              value={description}
            />
            <Button
              disabled={createReminder.isPending || !title.trim()}
              type="submit"
            >
              {createReminder.isPending ? "Saving…" : "Save reminder"}
            </Button>
          </form>
  );

  const paneComponent = isReminderLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
  ) : (
    <RemindPane items={paneItems} onDelete={handleDelete} />
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-10">
      <PaneLayout
        createForm={createForm}
        description="Schedule reminders and track what's due."
        paneComponent={paneComponent}
        title="Reminders"
      />
      <Card>
        <CardHeader>
          <CardTitle>Due now</CardTitle>
          <CardDescription>
            Reminders that already reached their due time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isDueLoading ? (
            <p className="text-muted-foreground text-sm">Checking…</p>
          ) : dueSoon.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing due right now.
            </p>
          ) : (
            <ul className="space-y-3">
              {dueSoon.map((reminder) => (
                <li
                  className="rounded-md border border-dashed p-3 shadow-sm"
                  key={reminder.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">{reminder.title}</h4>
                      <p className="text-muted-foreground text-xs">
                        Due{" "}
                        {typeof window !== "undefined"
                          ? new Date(reminder.due).toLocaleString()
                          : reminder.due}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700 text-xs">
                      Needs attention
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
