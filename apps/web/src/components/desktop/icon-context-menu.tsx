/**
 * Icon Context Menu - Right-click menu for desktop icons
 *
 * Provides actions for desktop icons including:
 * - Open (default on double-click)
 * - Visualize to Mindscape
 * - Delete
 *
 * @see docs/execplans/desktop-evolution-prd.md Part IV - Mindscape Integration
 */

import { ExternalLink, Trash2 } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { WindowType } from "@/store/desktop/types.new";

import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";
import { useMindscapeStore } from "@/store/mindscape";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface IconContextMenuProps {
  iconId: string;
  iconType: WindowType;
  label: string;
  position: { x: number; y: number };
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  variant?: "default" | "danger";
  shortcut?: string;
  isSeparator?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function IconContextMenu({
  iconId,
  iconType,
  label,
  position,
  isOpen,
  onClose,
  onOpen,
}: IconContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { removeDesktopIcon } = useDesktopStore();
  const { spawnFromIcon } = useMindscapeStore();

  // Handle outside click to close
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  // Focus the menu container so it can receive keyboard events.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    requestAnimationFrame(() => {
      menuRef.current?.focus();
    });
  }, [isOpen]);

  // Menu actions
  const handleOpen = useCallback(() => {
    onOpen();
    onClose();
  }, [onOpen, onClose]);

  const handleVisualize = useCallback(() => {
    const pos = {
      x: position.x - window.innerWidth / 2,
      y: position.y - window.innerHeight / 2,
    };
    spawnFromIcon(iconId, iconType, label, pos);
    useDesktopStore.getState().setMode("mindscape");
    onClose();
  }, [iconId, iconType, label, onClose, position.x, position.y, spawnFromIcon]);

  const handleDelete = useCallback(() => {
    removeDesktopIcon(iconId);
    onClose();
  }, [iconId, removeDesktopIcon, onClose]);

  // Memoize menu items to avoid re-render issues
  const menuItems = useMemo<MenuItem[]>(
    () => [
      {
        id: "open",
        label: "Open",
        icon: ExternalLink,
        action: handleOpen,
        shortcut: "↵",
      },
      {
        id: "visualize",
        label: "Visualize in Mindscape",
        icon: ExternalLink,
        action: handleVisualize,
      },
      {
        id: "separator1",
        label: "",
        icon: () => null,
        action: () => {},
        isSeparator: true,
      },
      {
        id: "delete",
        label: "Remove from Desktop",
        icon: Trash2,
        action: handleDelete,
        variant: "danger",
      },
    ],
    [handleOpen, handleVisualize, handleDelete]
  );

  const selectableIndices = useMemo(
    () =>
      menuItems
        .map((item, index) => (item.isSeparator ? null : index))
        .filter((v): v is number => typeof v === "number"),
    [menuItems]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const first = selectableIndices[0] ?? 0;
    setActiveIndex(first);
  }, [isOpen, selectableIndices]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const selectablePos = selectableIndices.indexOf(activeIndex);
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          if (selectableIndices.length === 0) {
            return;
          }
          const next =
            selectablePos === -1
              ? selectableIndices[0]
              : selectableIndices[
                  (selectablePos + 1) % selectableIndices.length
                ];
          if (typeof next === "number") {
            setActiveIndex(next);
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          if (selectableIndices.length === 0) {
            return;
          }
          const prev =
            selectablePos === -1
              ? selectableIndices.at(-1)
              : selectableIndices[
                  (selectablePos - 1 + selectableIndices.length) %
                    selectableIndices.length
                ];
          if (typeof prev === "number") {
            setActiveIndex(prev);
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          const item = menuItems[activeIndex];
          if (item && !item.isSeparator) {
            item.action();
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          onClose();
          break;
        }
      }
    },
    [activeIndex, menuItems, onClose, selectableIndices]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-3000 min-w-48 rounded-lg border border-white/10",
        "bg-void-surface/95 backdrop-blur-xl shadow-2xl",
        "animate-in fade-in zoom-in-95 duration-100"
      )}
      onKeyDown={handleKeyDown}
      role="menu"
      tabIndex={-1}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* Header */}
      <div className="border-white/5 border-b px-3 py-2">
        <p className="font-medium text-biolum text-sm">{label}</p>
      </div>

      {/* Menu Items */}
      <div className="p-1">
        {menuItems.map((item: MenuItem, index: number) => {
          if (item.isSeparator) {
            return (
              <div
                className="my-1 h-px bg-white/10"
                key={`separator-${item.id}`}
              />
            );
          }

          // biome-ignore lint/suspicious/noExplicitAny: Type inference issue
          const IconComponent = item.icon as unknown as React.FC<{
            className?: string;
          }>;

          return (
            <button
              className={cn(
                "flex w-full items-center justify-between rounded px-2 py-1.5 text-sm",
                "transition-colors duration-100",
                "focus:outline-none focus:bg-white/10",
                item.variant === "danger"
                  ? "text-red-400 hover:bg-red-500/10"
                  : "text-biolum hover:bg-white/5",
                activeIndex === index && "bg-white/10"
              )}
              key={item.id}
              onClick={item.action}
              onMouseEnter={() => setActiveIndex(index)}
              role="menuitem"
              tabIndex={activeIndex === index ? 0 : -1}
              type="button"
            >
              <div className="flex items-center gap-2">
                {/* biome-ignore lint/a11y/noSvgWithoutTitle: Decorative icon */}
                <IconComponent className="h-4 w-4" />
                <span>{item.label}</span>
              </div>
              {item.shortcut && (
                <span className="text-biolum-dim text-xs">{item.shortcut}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

interface UseIconContextMenuReturn {
  contextMenu: {
    iconId: string;
    iconType: WindowType;
    label: string;
    position: { x: number; y: number };
  } | null;
  openContextMenu: (
    iconId: string,
    iconType: WindowType,
    label: string,
    position: { x: number; y: number }
  ) => void;
  closeContextMenu: () => void;
}

export function useIconContextMenu(): UseIconContextMenuReturn {
  const [contextMenu, setContextMenu] = useState<{
    iconId: string;
    iconType: WindowType;
    label: string;
    position: { x: number; y: number };
  } | null>(null);

  const openContextMenu = useCallback(
    (
      iconId: string,
      iconType: WindowType,
      label: string,
      position: { x: number; y: number }
    ) => {
      setContextMenu({ iconId, iconType, label, position });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return { contextMenu, openContextMenu, closeContextMenu };
}

export default IconContextMenu;
