import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useMemo, useState } from "react";
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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>
            Add a quick note and keep track of it.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent notes</CardTitle>
          <CardDescription>Newest notes appear first.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="text-muted-foreground text-sm">No notes yet.</p>
          ) : (
            <ul className="space-y-4">
              {notes.map((note) => (
                <li className="rounded-md border p-4 shadow-sm" key={note.id}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      {note.title ? (
                        <h3 className="font-semibold text-lg">{note.title}</h3>
                      ) : null}
                      <p className="whitespace-pre-line text-muted-foreground text-sm">
                        {note.content}
                      </p>
                    </div>
                    <Button
                      disabled={deleteNote.isPending}
                      onClick={() => {
                        const input: DeleteNoteInput = { id: note.id };
                        deleteNote.mutate(input);
                      }}
                      size="sm"
                      variant="outline"
                    >
                      Delete
                    </Button>
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
