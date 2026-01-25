/**
 * Keyboard Navigation Utilities
 *
 * Provides keyboard navigation patterns for the desktop shell.
 *
 * @see docs/execplans/desktop-evolution-prd.md Part XIII (Accessibility)
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

export interface ArrowNavigationOptions {
  orientation?: "horizontal" | "vertical" | "both";
  loop?: boolean;
  onNavigate?: (index: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUT MANAGER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a keyboard shortcut manager
 */
export function createShortcutManager() {
  const shortcuts: KeyboardShortcut[] = [];

  const register = (shortcut: KeyboardShortcut) => {
    shortcuts.push(shortcut);
  };

  const unregister = (key: string) => {
    const index = shortcuts.findIndex((s) => s.key === key);
    if (index !== -1) {
      shortcuts.splice(index, 1);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const { key, ctrlKey, altKey, shiftKey, metaKey } = event;

    for (const shortcut of shortcuts) {
      const keyMatch = shortcut.key.toLowerCase() === key.toLowerCase();
      const ctrlMatch = !!shortcut.ctrl === ctrlKey;
      const altMatch = !!shortcut.alt === altKey;
      const shiftMatch = !!shortcut.shift === shiftKey;
      const metaMatch = !!shortcut.meta === metaKey;

      if (keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch) {
        event.preventDefault();
        shortcut.action();
        return;
      }
    }
  };

  const enable = () => {
    document.addEventListener("keydown", handleKeyDown);
  };

  const disable = () => {
    document.removeEventListener("keydown", handleKeyDown);
  };

  const getShortcuts = () => [...shortcuts];

  return { register, unregister, enable, disable, getShortcuts };
}

// ─────────────────────────────────────────────────────────────────────────────
// ARROW NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create arrow key navigation for a list of elements
 */
export function createArrowNavigation(
  elements: HTMLElement[],
  options: ArrowNavigationOptions = {}
) {
  const { orientation = "vertical", loop = true, onNavigate } = options;
  let currentIndex = 0;

  const navigate = (direction: "next" | "prev") => {
    const { length } = elements;
    if (length === 0) {
      return;
    }

    if (direction === "next") {
      currentIndex = loop
        ? (currentIndex + 1) % length
        : Math.min(currentIndex + 1, length - 1);
    } else {
      currentIndex = loop
        ? (currentIndex - 1 + length) % length
        : Math.max(currentIndex - 1, 0);
    }

    elements[currentIndex]?.focus();
    onNavigate?.(currentIndex);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const { key } = event;

    if (orientation === "vertical" || orientation === "both") {
      if (key === "ArrowDown") {
        event.preventDefault();
        navigate("next");
      } else if (key === "ArrowUp") {
        event.preventDefault();
        navigate("prev");
      }
    }

    if (orientation === "horizontal" || orientation === "both") {
      if (key === "ArrowRight") {
        event.preventDefault();
        navigate("next");
      } else if (key === "ArrowLeft") {
        event.preventDefault();
        navigate("prev");
      }
    }

    // Home/End navigation
    if (key === "Home") {
      event.preventDefault();
      currentIndex = 0;
      elements[0]?.focus();
      onNavigate?.(0);
    } else if (key === "End") {
      event.preventDefault();
      currentIndex = elements.length - 1;
      elements.at(-1)?.focus();
      onNavigate?.(currentIndex);
    }
  };

  const setIndex = (index: number) => {
    currentIndex = Math.max(0, Math.min(index, elements.length - 1));
    elements[currentIndex]?.focus();
  };

  return {
    handleKeyDown,
    navigate,
    setIndex,
    getCurrentIndex: () => currentIndex,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROVING TABINDEX
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Implement roving tabindex pattern
 */
export function createRovingTabindex(container: HTMLElement, selector: string) {
  const elements = [...container.querySelectorAll<HTMLElement>(selector)];
  let activeIndex = 0;

  // Initialize: set tabindex=-1 on all but first
  for (const [index, element] of elements.entries()) {
    element.setAttribute("tabindex", index === 0 ? "0" : "-1");
  }

  const setActive = (index: number) => {
    if (index < 0 || index >= elements.length) {
      return;
    }

    // Remove tabindex from previous
    elements[activeIndex]?.setAttribute("tabindex", "-1");

    // Set tabindex on new
    activeIndex = index;
    elements[activeIndex]?.setAttribute("tabindex", "0");
    elements[activeIndex]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const { key } = event;

    if (key === "ArrowRight" || key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % elements.length);
    } else if (key === "ArrowLeft" || key === "ArrowUp") {
      event.preventDefault();
      setActive((activeIndex - 1 + elements.length) % elements.length);
    } else if (key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (key === "End") {
      event.preventDefault();
      setActive(elements.length - 1);
    }
  };

  container.addEventListener("keydown", handleKeyDown);

  const destroy = () => {
    container.removeEventListener("keydown", handleKeyDown);
  };

  return { setActive, getActive: () => activeIndex, destroy };
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS DISPLAY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a keyboard shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.meta) {
    parts.push("⌘");
  }
  if (shortcut.ctrl) {
    parts.push("Ctrl");
  }
  if (shortcut.alt) {
    parts.push("Alt");
  }
  if (shortcut.shift) {
    parts.push("Shift");
  }
  parts.push(shortcut.key.toUpperCase());

  return parts.join("+");
}
