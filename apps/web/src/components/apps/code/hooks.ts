import { useCallback, useEffect, useState } from "react";

import type { EditorSettings, FileTab } from "./types";

import { DEFAULT_EDITOR_SETTINGS } from "./types";

const SETTINGS_KEY = "alfred-code-editor-settings";

export function useEditorSettings() {
  const [settings, setSettings] = useState<EditorSettings>(
    DEFAULT_EDITOR_SETTINGS
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings({ ...DEFAULT_EDITOR_SETTINGS, ...JSON.parse(stored) });
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const updateSettings = useCallback((updates: Partial<EditorSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  return { settings, updateSettings };
}

export function useKeyboardShortcuts({
  onSave,
  onCloseTab,
  onOpenSearch,
  onNewFile,
  activeTab,
}: {
  onSave: () => void;
  onCloseTab: () => void;
  onOpenSearch: () => void;
  onNewFile: () => void;
  activeTab: FileTab | undefined;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === "s") {
        e.preventDefault();
        onSave();
        return;
      }

      if (isMod && e.key === "w") {
        e.preventDefault();
        if (activeTab) {
          onCloseTab();
        }
        return;
      }

      if (isMod && e.key === "p") {
        e.preventDefault();
        onOpenSearch();
        return;
      }

      if (isMod && e.key === "n") {
        e.preventDefault();
        onNewFile();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave, onCloseTab, onOpenSearch, onNewFile, activeTab]);
}

export function useUnsavedChangesWarning(tabs: FileTab[]) {
  const hasDirtyTabs = tabs.some((t) => t.isDirty);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasDirtyTabs) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasDirtyTabs]);

  return hasDirtyTabs;
}
