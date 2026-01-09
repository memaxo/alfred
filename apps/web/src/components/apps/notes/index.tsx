"use client";

/**
 * Modern Notes Application - Phase 3 Productivity
 *
 * Features:
 * - Note organization with folders/tags
 * - Markdown preview toggle
 * - Auto-save to local storage (for now)
 * - Clean, distraction-free interface
 */

import {
  Clock,
  Edit3,
  Eye,
  File,
  FileText,
  Hash,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { WindowComponentProps } from "@/components/desktop/windows/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Note = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function NotesApp({ windowId: _windowId }: { windowId?: string }) {
  const [notes, setNotes] = useState<Note[]>(() => {
    // Load from local storage on init
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("alfred-notes");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
    }
    return [
      {
        id: "1",
        title: "Welcome to ALFRED Notes",
        content:
          "# Welcome\n\nThis is your new distraction-free space for thoughts and documentation.\n\n## Features\n- Markdown support\n- Real-time preview\n- Auto-saving\n- Tags organization",
        tags: ["guide"],
        updatedAt: Date.now(),
      },
    ];
  });

  const [activeNoteId, setActiveNoteId] = useState<string | null>(
    notes[0]?.id || null
  );
  const [search, setSearch] = useState("");
  const [isPreview, setIsPreview] = useState(false);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) || null,
    [notes, activeNoteId]
  );

  const filteredNotes = useMemo(() => {
    if (!search) {
      return notes;
    }
    const s = search.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(s) || n.content.toLowerCase().includes(s)
    );
  }, [notes, search]);

  const handleSave = useCallback((updatedNote: Note) => {
    setNotes((prev) => {
      const next = prev.map((n) => (n.id === updatedNote.id ? updatedNote : n));
      if (typeof window !== "undefined") {
        localStorage.setItem("alfred-notes", JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const handleCreate = useCallback(() => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: "Untitled Note",
      content: "",
      tags: [],
      updatedAt: Date.now(),
    };
    const next = [newNote, ...notes];
    setNotes(next);
    setActiveNoteId(newNote.id);
    if (typeof window !== "undefined") {
      localStorage.setItem("alfred-notes", JSON.stringify(next));
    }
  }, [notes]);

  const handleDelete = useCallback(
    (id: string) => {
      const next = notes.filter((n) => n.id !== id);
      setNotes(next);
      if (activeNoteId === id) {
        setActiveNoteId(next[0]?.id || null);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("alfred-notes", JSON.stringify(next));
      }
    },
    [notes, activeNoteId]
  );

  const updateActiveNote = useCallback(
    (updates: Partial<Note>) => {
      if (!activeNoteId) {
        return;
      }
      const note = notes.find((n) => n.id === activeNoteId);
      if (!note) {
        return;
      }

      const updated = { ...note, ...updates, updatedAt: Date.now() };
      handleSave(updated);
    },
    [activeNoteId, notes, handleSave]
  );

  return (
    <div className="flex h-full w-full bg-void">
      {/* Sidebar */}
      <div className="flex w-64 flex-col border-white/5 border-r">
        <div className="flex h-12 items-center justify-between border-white/5 border-b px-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-biolum" />
            <span className="font-medium text-sm">Notes</span>
          </div>
          <Button
            className="h-8 w-8 text-biolum hover:bg-biolum/10"
            onClick={handleCreate}
            size="icon"
            variant="ghost"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 h-3.5 w-3.5 text-biolum-dim" />
            <Input
              className="h-8 border-white/5 bg-white/5 pl-8 text-xs focus:border-biolum/50"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes..."
              value={search}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {filteredNotes.map((note) => (
              <button
                className={cn(
                  "group flex w-full flex-col gap-1 rounded-lg p-2.5 text-left transition-all",
                  activeNoteId === note.id
                    ? "bg-biolum/15 ring-1 ring-biolum/30"
                    : "hover:bg-white/5"
                )}
                key={note.id}
                onClick={() => setActiveNoteId(note.id)}
                type="button"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "truncate font-medium text-xs",
                      activeNoteId === note.id
                        ? "text-biolum"
                        : "text-biolum-dim group-hover:text-biolum"
                    )}
                  >
                    {note.title || "Untitled Note"}
                  </span>
                  <button
                    className="opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(note.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-biolum-faint">
                  <Clock className="h-2.5 w-2.5" />
                  <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                  {note.tags.length > 0 && (
                    <div className="flex gap-1">
                      {note.tags.map((t) => (
                        <span className="flex items-center gap-0.5" key={t}>
                          <Hash className="h-2 w-2" />
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Editor */}
      <div className="flex flex-1 flex-col">
        {activeNote ? (
          <>
            <div className="flex h-12 items-center justify-between border-white/5 border-b px-4">
              <div className="flex flex-1 items-center gap-2">
                <Input
                  className="h-8 border-none bg-transparent p-0 font-semibold text-biolum focus-visible:ring-0"
                  onChange={(e) => updateActiveNote({ title: e.target.value })}
                  value={activeNote.title}
                />
              </div>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className={cn(
                          "h-8 w-8 text-biolum-dim",
                          isPreview && "bg-biolum/10 text-biolum"
                        )}
                        onClick={() => setIsPreview(!isPreview)}
                        size="icon"
                        variant="ghost"
                      >
                        {isPreview ? (
                          <Edit3 className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isPreview ? "Back to Editor" : "Preview Markdown"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="flex-1 overflow-hidden p-4">
              {isPreview ? (
                <ScrollArea className="h-full">
                  <div className="prose prose-invert prose-sm prose-biolum max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-biolum-dim">
                      {activeNote.content || "No content"}
                    </pre>
                  </div>
                </ScrollArea>
              ) : (
                <Textarea
                  autoFocus
                  className="h-full w-full resize-none border-none bg-transparent p-0 font-mono text-biolum-dim focus-visible:ring-0"
                  onChange={(e) =>
                    updateActiveNote({ content: e.target.value })
                  }
                  placeholder="Start writing..."
                  value={activeNote.content}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-biolum-dim">
            <div className="text-center">
              <File className="mx-auto mb-2 h-12 w-12 opacity-20" />
              <p className="text-sm">Select or create a note</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function NotesAppWindow(props: WindowComponentProps) {
  return <NotesApp windowId={props.window.id} />;
}

export default NotesApp;
