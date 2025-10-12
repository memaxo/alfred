import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/note")({
  component: NoteRoute,
});

function NoteRoute() {
  const trpc = useTRPC();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const notes = useQuery(
    trpc.note.list.queryOptions({
      limit: 50,
      offset: 0,
    }),
  );

  const createNote = useMutation(
    trpc.note.create.mutationOptions({
      onSuccess: () => {
        notes.refetch();
        setTitle("");
        setContent("");
      },
    })
  );

  const deleteNote = useMutation(
    trpc.note.delete.mutationOptions({
      onSuccess: () => {
        notes.refetch();
      },
    })
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim()) {
      return;
    }
    createNote.mutate({
      title: title.trim() || undefined,
      content,
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Add a quick note and keep track of it.</CardDescription>
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
          {notes.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (notes.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="space-y-4">
              {notes.data?.map((note) => (
                <li
                  className="rounded-md border p-4 shadow-sm"
                  key={note.id}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      {note.title ? (
                        <h3 className="text-lg font-semibold">{note.title}</h3>
                      ) : null}
                      <p className="whitespace-pre-line text-sm text-muted-foreground">
                        {note.content}
                      </p>
                    </div>
                    <Button
                      disabled={deleteNote.isPending}
                      onClick={() => deleteNote.mutate({ id: note.id })}
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
