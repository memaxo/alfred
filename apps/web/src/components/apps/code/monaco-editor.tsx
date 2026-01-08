"use client";

/**
 * Monaco Editor - Code editor integration
 *
 * Full Monaco integration with ALFRED void theme.
 */

import { Editor } from "@monaco-editor/react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

type MonacoEditorProps = {
  content: string;
  language: string;
  path: string;
  onChange: (content: string) => void;
  className?: string;
};

export function MonacoEditor({
  content,
  language,
  path,
  onChange,
  className,
}: MonacoEditorProps) {
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
        },
      });
      monaco.editor.setTheme("alfred-void");
    };

    configureTheme();
  }, []);

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
        options={{
          automaticLayout: true,
          fontSize: 14,
          fontFamily: "Menlo, Monaco, 'Courier New', monospace",
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          lineNumbers: "on",
          renderLineHighlight: "all",
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          smoothScrolling: true,
          tabSize: 2,
          insertSpaces: true,
        }}
        path={path}
        theme="alfred-void"
        value={content}
      />
    </div>
  );
}
