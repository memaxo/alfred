import type { NodeProps } from "@xyflow/react";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { inferRouterInputs } from "@trpc/server";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { MindscapeNode } from "./mindscape-node";
import { noteNodeDataSchema } from "@/store/mindscape.schemas";
import { useMindscapeStore } from "@/store/mindscape";
import { trpc, type TRPCAppRouter } from "@/utils/trpc";

const NOTE_LIST_KEY = { limit: 50, offset: 0 } as const;

export function NoteNode({ id, data, selected }: NodeProps) {
  const result = noteNodeDataSchema.safeParse(data);
  const parsed = result.success
    ? result.data
    : {
        noteId: undefined,
        title: undefined,
        content: undefined,
        tags: undefined,
        mode: "edit" as const,
      };

  const computedMode = parsed.mode ?? (parsed.noteId ? "view" : "edit");
  const isEditing = computedMode === "edit";

  const [draftTitle, setDraftTitle] = useState(parsed.title ?? "");
  const [draftContent, setDraftContent] = useState(parsed.content ?? "");

  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(parsed.title ?? "");
      setDraftContent(parsed.content ?? "");
    }
  }, [isEditing, parsed.title, parsed.content]);

  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );
  const removeArtifact = useMindscapeStore((state) => state.removeArtifact);

  const utils = trpc.useUtils();
  type RouterInputs = inferRouterInputs<TRPCAppRouter>;

  const createNote = trpc.note.create.useMutation({
    onSuccess: async (note) => {
      toast.success("Note created");
      updateArtifactData(id, {
        noteId: note.id,
        title: note.title,
        content: note.content,
        label: note.title?.trim() || "Untitled Note",
        mode: "view",
        updatedAt: note.updatedAt?.toISOString?.() ?? new Date().toISOString(),
      });
      await utils.note.list.invalidate(NOTE_LIST_KEY);
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to create note");
    },
  });

  const updateNote = trpc.note.update.useMutation({
    onSuccess: async () => {
      toast.success("Note updated");
      updateArtifactData(id, {
        title: draftTitle.trim() || undefined,
        content: draftContent,
        label: draftTitle.trim() || "Untitled Note",
        mode: "view",
        updatedAt: new Date().toISOString(),
      });
      await utils.note.list.invalidate(NOTE_LIST_KEY);
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to update note");
    },
  });

  const deleteNote = trpc.note.delete.useMutation({
    onSuccess: async () => {
      toast.success("Note deleted");
      removeArtifact(id);
      await utils.note.list.invalidate(NOTE_LIST_KEY);
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to delete note");
    },
  });

  const isMutating = createNote.isPending || updateNote.isPending;
  const isDeleting = deleteNote.isPending;

  const handleSave = (event?: React.FormEvent) => {
    event?.preventDefault();
    const hasContent = draftContent.trim().length > 0;
    if (!hasContent) {
      toast.error("Note content cannot be empty");
      return;
    }
    const trimmedTitle = draftTitle.trim();
    setDraftTitle(trimmedTitle);

    if (!parsed.noteId) {
      const input: RouterInputs["note"]["create"] = {
        title: trimmedTitle || undefined,
        content: draftContent,
      };
      createNote.mutate(input);
      return;
    }

    const payload: RouterInputs["note"]["update"] = { id: parsed.noteId };
    if (trimmedTitle !== (parsed.title ?? "")) {
      payload.title = trimmedTitle || undefined;
    }
    if (draftContent !== (parsed.content ?? "")) {
      payload.content = draftContent;
    }

    if (!payload.title && !payload.content) {
      toast.info("No changes to save");
      updateArtifactData(id, { mode: "view" });
      return;
    }

    updateNote.mutate(payload);
  };

  const handleDelete = () => {
    if (!parsed.noteId) {
      removeArtifact(id);
      return;
    }
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete this note?");
      if (!confirmed) {
        return;
      }
    }
    deleteNote.mutate({ id: parsed.noteId });
  };

  const handleCancel = () => {
    setDraftTitle(parsed.title ?? "");
    setDraftContent(parsed.content ?? "");
    updateArtifactData(id, { mode: "view" });
  };

  const enterEditMode = () => {
    updateArtifactData(id, { mode: "edit" });
  };

  const headerIcon = <FileText className="h-4 w-4 text-yellow-500" />;

  const updatedLabel = useMemo(() => {
    if (!parsed.updatedAt) return null;
    const date = new Date(parsed.updatedAt);
    if (Number.isNaN(date.getTime())) {
      return parsed.updatedAt;
    }
    return date.toLocaleString();
  }, [parsed.updatedAt]);

  return (
    <MindscapeNode
      className="w-[360px] border-yellow-500/20 bg-yellow-950/10"
      headerActions={headerIcon}
      id={id}
      selected={selected}
      title={parsed.title?.trim() || "Untitled Note"}
    >
      <div className="flex flex-col gap-3 p-4">
        {isEditing ? (
          <form className="flex flex-col gap-3" onSubmit={handleSave}>
            <Input
              autoFocus
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="Title (optional)"
              value={draftTitle}
            />
            <Textarea
              className="min-h-[140px]"
              onChange={(event) => setDraftContent(event.target.value)}
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
                  {parsed.noteId ? "Delete" : "Discard"}
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
                <Button disabled={isMutating} size="sm" type="submit">
                  {isMutating ? (
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
            <div className="flex items-center justify-between text-xs text-biolum-faint">
              <span>{parsed.noteId ? "Synced" : "Draft"}</span>
              {updatedLabel && <span>Updated {updatedLabel}</span>}
            </div>
            <ScrollArea className="h-[200px]">
              <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                {parsed.content || <span className="italic opacity-50">No content</span>}
              </div>
            </ScrollArea>
            {parsed.tags && parsed.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {parsed.tags.map((tag) => (
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
              {parsed.noteId && (
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
    </MindscapeNode>
  );
}
