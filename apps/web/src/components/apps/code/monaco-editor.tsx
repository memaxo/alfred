"use client";

/**
 * Monaco Editor - Code editor integration
 *
 * Full Monaco integration with ALFRED void theme and customizable settings.
 */

import { Editor, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import type { EditorSettings } from "./types";

import { DEFAULT_EDITOR_SETTINGS } from "./types";

interface MonacoEditorProps {
  content: string;
  language: string;
  path: string;
  onChange: (content: string) => void;
  settings?: EditorSettings;
  onCursorChange?: (line: number, column: number) => void;
  className?: string;
}

export function MonacoEditor({
  content,
  language,
  path,
  onChange,
  settings = DEFAULT_EDITOR_SETTINGS,
  onCursorChange,
  className,
}: MonacoEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  // Configure ALFRED void theme
  useEffect(() => {
    const configureTheme = async () => {
      const monaco = await import("monaco-editor");
      monaco.editor.defineTheme("alfred-void", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "", foreground: "fafafa", background: "09090b" },
          { token: "comment", foreground: "71717a", fontStyle: "italic" },
          { token: "keyword", foreground: "a855f7" },
          { token: "string", foreground: "22c55e" },
          { token: "number", foreground: "eab308" },
          { token: "type", foreground: "3b82f6" },
          { token: "class", foreground: "06b6d4" },
          { token: "function", foreground: "c084fc" },
          { token: "variable", foreground: "f472b6" },
          { token: "operator", foreground: "94a3b8" },
        ],
        colors: {
          "editor.background": "#09090b",
          "editor.foreground": "#fafafa",
          "editor.lineHighlightBackground": "#18181b",
          "editor.selectionBackground": "#27272a",
          "editor.inactiveSelectionBackground": "#18181b",
          "editorCursor.foreground": "#fafafa",
          "editorWhitespace.foreground": "#27272a",
          "editorIndentGuide.activeBackground": "#27272a",
          "editorIndentGuide.background": "#18181b",
          "editorLineNumber.foreground": "#71717a",
          "editorLineNumber.activeForeground": "#fafafa",
          "editorGutter.background": "#09090b",
          "editorBracketMatch.background": "#27272a",
          "editorBracketMatch.border": "#a855f7",
        },
      });
      monaco.editor.setTheme("alfred-void");
    };

    configureTheme();
  }, []);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      onCursorChange?.(e.position.lineNumber, e.position.column);
    });

    // Add custom keybindings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
      editor.getAction("editor.action.copyLinesDownAction")?.run();
    });
  };

  // Detect language from file extension if not provided
  const detectedLanguage =
    language ||
    (path.includes(".")
      ? path.split(".").pop()?.toLowerCase() || "plaintext"
      : "plaintext");

  return (
    <div className={cn("h-full w-full", className)}>
      <Editor
        height="100%"
        language={detectedLanguage}
        onChange={(value) => onChange(value ?? "")}
        onMount={handleEditorMount}
        options={{
          automaticLayout: true,
          fontSize: settings.fontSize,
          fontFamily: "Menlo, Monaco, 'Courier New', monospace",
          minimap: { enabled: settings.minimap },
          scrollBeyondLastLine: false,
          wordWrap: settings.wordWrap,
          lineNumbers: settings.lineNumbers,
          renderLineHighlight: "all",
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          smoothScrolling: true,
          tabSize: settings.tabSize,
          insertSpaces: true,
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          suggest: {
            showKeywords: true,
            showSnippets: true,
          },
        }}
        path={path}
        theme="alfred-void"
        value={content}
      />
    </div>
  );
}

export function insertTextAtCursor(
  editorRef: React.RefObject<Parameters<OnMount>[0] | null>,
  text: string
) {
  const editor = editorRef.current;
  if (!editor) {
    return;
  }

  const position = editor.getPosition();
  if (!position) {
    return;
  }

  editor.executeEdits("ai-suggestion", [
    {
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
      text,
    },
  ]);
}
