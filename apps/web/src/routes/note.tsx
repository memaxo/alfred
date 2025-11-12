import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useMemo, useState } from "react";
import { NotePane, type NotePaneItem } from "@alfred/ui";
import { RouteError } from "@/components/route-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaneLayout } from "@/components/pane-layout";
import type { TRPCAppRouter } from "@/utils/trpc";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/note")({
  component: NoteRoute,
  errorComponent: RouteError,
});

function NoteRoute() {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const listInput = useMemo(() => ({ limit: 50, offset: 0 }), []);

  const noteListQuery = trpc.note.list.useQuery(listInput);
  type NoteListItem = inferRouterOutputs<TRPCAppRouter>["note"]["list"][number];
  type RouterInputs = inferRouterInputs<TRPCAppRouter>;
  type CreateNoteInput = RouterInputs["note"]["create"];
  type DeleteNoteInput = RouterInputs["note"]["delete"];
  const notes: NoteListItem[] = noteListQuery.data ?? [];
  const isLoading = noteListQuery.isLoading;

  const createNote = trpc.note.create.useMutation({
    onSuccess: async () => {
      await utils.note.list.invalidate(listInput);
      setTitle("");
      setContent("");
    },
  });

  const deleteNote = trpc.note.delete.useMutation({
    onSuccess: async () => {
      await utils.note.list.invalidate(listInput);
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim()) {
      return;
    }
    const input: CreateNoteInput = {
      title: title.trim() || undefined,
      content,
    };
    createNote.mutate(input);
  };

  const handleDelete = (id: string) => {
    const input: DeleteNoteInput = { id };
    deleteNote.mutate(input);
  };

  const paneItems: NotePaneItem[] = useMemo(
    () =>
      notes.map((note) => ({
        id: note.id,
        title: note.title ?? null,
        content: note.content,
        createdAt: note.createdAt?.toISOString() ?? null,
      })),
    [notes]
  );

  const createForm = (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              disabled={createNote.isPending}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title (optional)"
              value={title}
            />
            <textarea
              className="w-full rounded-md border border-input bg-background p-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={createNote.isPending}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write your note..."
              rows={4}
              value={content}
            />
            <Button
              disabled={createNote.isPending || !content.trim()}
              type="submit"
            >
              {createNote.isPending ? "Saving…" : "Save note"}
            </Button>
          </form>
  );

  const paneComponent =
    isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
    ) : (
      <NotePane items={paneItems} onDelete={handleDelete} />
    );

  return (
    <PaneLayout
      createForm={createForm}
      description="Add a quick note and keep track of it."
      paneComponent={paneComponent}
      title="Notes"
    />
  );
}
