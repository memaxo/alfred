import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/utils/trpc";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { TRPCAppRouter } from "@/utils/trpc";

export const Route = createFileRoute("/remind")({
  component: RemindRoute,
});

function RemindRoute() {
  const utils = trpc.useUtils();
  const defaultDue = useMemo(() => {
    const start = new Date(Date.now() + 5 * 60 * 1000);
    return start.toISOString().slice(0, 16);
  }, []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState(defaultDue);
  const listInput = useMemo(() => ({ limit: 50, offset: 0 }), []);
  const [dueBefore, setDueBefore] = useState(() => new Date().toISOString());
  const dueInput = useMemo(() => ({ before: dueBefore }), [dueBefore]);

  type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
  type RouterInputs = inferRouterInputs<TRPCAppRouter>;
  type CreateReminderInput = RouterInputs["remind"]["create"];
  type DeleteReminderInput = RouterInputs["remind"]["delete"];
  type ReminderItem = RouterOutputs["remind"]["list"][number];
  type DueReminderItem = RouterOutputs["remind"]["due"][number];

  const reminderListQuery = trpc.remind.list.useQuery(listInput);
  const dueRemindersQuery = trpc.remind.due.useQuery(dueInput, {
    staleTime: 5_000,
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
      await Promise.all([utils.remind.list.invalidate(listInput), refreshDue()]);
      setTitle("");
      setDescription("");
      setDue(defaultDue);
    },
  });

  const deleteReminder = trpc.remind.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.remind.list.invalidate(listInput), refreshDue()]);
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !due) {
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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <CardDescription>Schedule reminders and track what&apos;s due.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming reminders</CardTitle>
          <CardDescription>Next 50 reminders sorted by due time.</CardDescription>
        </CardHeader>
        <CardContent>
          {isReminderLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : reminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reminders scheduled.</p>
          ) : (
            <ul className="space-y-3">
              {reminders.map((reminder) => (
                <li
                  className="flex items-start justify-between gap-4 rounded-md border p-3 shadow-sm"
                  key={reminder.id}
                >
                  <div>
                    <h3 className="text-base font-semibold">{reminder.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      Due {new Date(reminder.due).toLocaleString()}
                    </p>
                    {reminder.description ? (
                      <p className="pt-1 text-sm text-muted-foreground">
                        {reminder.description}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    disabled={deleteReminder.isPending}
                    onClick={() => {
                      const input: DeleteReminderInput = { id: reminder.id };
                      deleteReminder.mutate(input);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Due now</CardTitle>
          <CardDescription>Reminders that already reached their due time.</CardDescription>
        </CardHeader>
        <CardContent>
          {isDueLoading ? (
            <p className="text-sm text-muted-foreground">Checking…</p>
          ) : dueSoon.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due right now.</p>
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
                      <p className="text-xs text-muted-foreground">
                        Due {new Date(reminder.due).toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
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
