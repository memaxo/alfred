import { useLiveQuery } from "@tanstack/react-db";
import type { NodeProps } from "@xyflow/react";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useNoteCollection } from "@/collections";
import type { NoteResource } from "@/collections/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";
import { useDesktopStore } from "@/store/desktop";

const noteWindowDataSchema = z.object({
  type: z.literal("note"),
  label: z.string().optional(),
  resourceRef: z
    .object({
      type: z.literal("note"),
      id: z.string(),
    })
    .optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
  draft: z.unknown().optional(),
});

export function NoteWindow({ id, data, selected }: NodeProps) {
  const parsed = noteWindowDataSchema.safeParse(data);
  const windowData = parsed.success
    ? parsed.data
    : { type: "note" as const, viewMode: "full" as const };
  const lod = useLOD();
  const { collection, insertNote, updateNote, deleteNote } =
    useNoteCollection();

  const resourceId = windowData.resourceRef?.id;

  const { data: notes, isLoading } = useLiveQuery(
    (q) =>
      q
        .from({ note: collection })
        .where(({ note }) => (resourceId ? note.id === resourceId : false))
        .select(({ note }) => note),
    [resourceId, collection]
  );

  const note = notes?.[0] as NoteResource | undefined;
  const isNew = !resourceId;

  const [mode, setMode] = useState<"view" | "edit">(isNew ? "edit" : "view");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateWindow = useDesktopStore((s) => s.updateWindow);
  const removeWindow = useDesktopStore((s) => s.removeWindow);

  useEffect(() => {
    if (note && mode === "view") {
      setDraftTitle(note.title ?? "");
      setDraftContent(note.content ?? "");
    }
  }, [note, mode]);

  useEffect(() => {
    if (isNew) {
      setMode("edit");
    }
  }, [isNew]);

  const handleSave = useCallback(
    (event?: React.FormEvent) => {
      event?.preventDefault();

      if (!draftContent.trim()) {
        toast.error("Note content cannot be empty");
        return;
      }

      setIsSaving(true);
      try {
        if (isNew) {
          const newId = crypto.randomUUID();
          insertNote({
            title: draftTitle.trim() || null,
            content: draftContent,
            tags: [],
          });
          updateWindow(id, {
            resourceRef: { type: "note", id: newId },
            label: draftTitle.trim() || "Untitled Note",
          });
          toast.success("Note created");
        } else if (resourceId) {
          updateNote({
            id: resourceId,
            title: draftTitle.trim() || null,
            content: draftContent,
          });
          updateWindow(id, {
            label: draftTitle.trim() || "Untitled Note",
          });
          toast.success("Note updated");
        }
        setMode("view");
      } catch {
        toast.error("Failed to save note");
      } finally {
        setIsSaving(false);
      }
    },
    [
      draftContent,
      draftTitle,
      id,
      insertNote,
      isNew,
      resourceId,
      updateNote,
      updateWindow,
    ]
  );

  const handleDelete = useCallback(() => {
    if (isNew) {
      removeWindow(id);
      return;
    }

    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete this note?");
      if (!confirmed) {
        return;
      }
    }

    setIsDeleting(true);
    try {
      if (resourceId) {
        deleteNote(resourceId);
      }
      removeWindow(id);
      toast.success("Note deleted");
    } catch (_error) {
      toast.error("Failed to delete note");
      setIsDeleting(false);
    }
  }, [deleteNote, id, isNew, removeWindow, resourceId]);

  const handleCancel = useCallback(() => {
    if (isNew) {
      removeWindow(id);
      return;
    }
    setDraftTitle(note?.title ?? "");
    setDraftContent(note?.content ?? "");
    setMode("view");
  }, [id, isNew, note, removeWindow]);

  const enterEditMode = useCallback(() => {
    setMode("edit");
  }, []);

  const displayTitle =
    note?.title?.trim() || draftTitle.trim() || "Untitled Note";

  const updatedLabel = useMemo(() => {
    if (!note?.updated) {
      return null;
    }
    const date = new Date(note.updated);
    if (Number.isNaN(date.getTime())) {
      return note.updated;
    }
    return date.toLocaleString();
  }, [note?.updated]);

  if (lod === "tiny") {
    return <TinyDot color="bg-yellow-500" shadow="shadow-yellow-500/50" />;
  }

  if (lod === "small") {
    return (
      <SmallCard
        borderColor="border-yellow-500/20"
        hoverColor="hover:border-yellow-500/40"
        icon={<FileText className="h-3 w-3" />}
        label={displayTitle}
        textColor="text-yellow-500"
      />
    );
  }

  const headerIcon = <FileText className="h-4 w-4 text-yellow-500" />;

  return (
    <WindowFrame
      actions={headerIcon}
      id={id}
      selected={selected}
      title={displayTitle}
      windowType="note"
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
              placeholder="Title (optional)"
              value={draftTitle}
            />
            <Textarea
              className="min-h-[140px]"
              onChange={(e) => setDraftContent(e.target.value)}
              placeholder="Write your note..."
              value={draftContent}
            />
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
            <div className="flex items-center justify-between text-biolum-faint text-xs">
              <span>{resourceId ? "Synced" : "Draft"}</span>
              {updatedLabel && <span>Updated {updatedLabel}</span>}
            </div>
            <ScrollArea className="h-[200px]">
              <div className="whitespace-pre-wrap text-muted-foreground text-sm">
                {note?.content || (
                  <span className="italic opacity-50">No content</span>
                )}
              </div>
            </ScrollArea>
            {note?.tags && note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {note.tags.map((tag) => (
                  <Badge
                    className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20"
                    key={tag}
                    variant="secondary"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button onClick={enterEditMode} size="sm" variant="secondary">
                Edit
              </Button>
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
