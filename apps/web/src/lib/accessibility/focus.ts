/**
 * Focus Management System
 *
 * Provides utilities for managing focus across the desktop shell.
 * Ensures proper focus handling for modals, overlays, and window transitions.
 *
 * @see docs/execplans/desktop-evolution-prd.md Part XIII (Accessibility)
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type FocusableElement = HTMLElement & {
  focus: (options?: FocusOptions) => void;
};

export interface FocusTrapOptions {
  initialFocus?: HTMLElement | string;
  returnFocus?: boolean;
  escapeDeactivates?: boolean;
  onEscape?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable]",
  "audio[controls]",
  "video[controls]",
  "details > summary",
].join(", ");

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(
  container: HTMLElement
): FocusableElement[] {
  const elements =
    container.querySelectorAll<FocusableElement>(FOCUSABLE_SELECTOR);
  return [...elements].filter((el) => {
    // Filter out hidden elements
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

/**
 * Get the first focusable element in a container
 */
export function getFirstFocusable(
  container: HTMLElement
): FocusableElement | null {
  const elements = getFocusableElements(container);
  return elements[0] ?? null;
}

/**
 * Get the last focusable element in a container
 */
export function getLastFocusable(
  container: HTMLElement
): FocusableElement | null {
  const elements = getFocusableElements(container);
  return elements.at(-1) ?? null;
}

/**
 * Check if an element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  return element.matches(FOCUSABLE_SELECTOR);
}

// ─────────────────────────────────────────────────────────────────────────────
// FOCUS TRAP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a focus trap within a container
 */
export function createFocusTrap(
  container: HTMLElement,
  options: FocusTrapOptions = {}
) {
  const {
    initialFocus,
    returnFocus = true,
    escapeDeactivates = true,
    onEscape,
  } = options;

  let previouslyFocused: HTMLElement | null = null;
  let isActive = false;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isActive) {
      return;
    }

    if (event.key === "Tab") {
      const focusableElements = getFocusableElements(container);
      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      const activeElement = document.activeElement as HTMLElement;

      if (event.shiftKey && activeElement === firstElement) {
        // Shift + Tab: go to previous
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        // Tab: go to next
        event.preventDefault();
        firstElement?.focus();
      }
    }

    if (event.key === "Escape" && escapeDeactivates) {
      event.preventDefault();
      onEscape?.();
      deactivate();
    }
  };

  const activate = () => {
    if (isActive) {
      return;
    }

    isActive = true;
    previouslyFocused = document.activeElement as HTMLElement;

    // Set initial focus
    if (initialFocus) {
      const element =
        typeof initialFocus === "string"
          ? container.querySelector<HTMLElement>(initialFocus)
          : initialFocus;
      element?.focus();
    } else {
      getFirstFocusable(container)?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
  };

  const deactivate = () => {
    if (!isActive) {
      return;
    }

    isActive = false;
    document.removeEventListener("keydown", handleKeyDown);

    if (returnFocus && previouslyFocused) {
      previouslyFocused.focus();
    }
  };

  return { activate, deactivate, isActive: () => isActive };
}

// ─────────────────────────────────────────────────────────────────────────────
// FOCUS RESTORATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save and restore focus for window transitions
 */
export function createFocusRestoration() {
  const focusHistory = new Map<string, HTMLElement>();

  const save = (windowId: string) => {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement !== document.body) {
      focusHistory.set(windowId, activeElement);
    }
  };

  const restore = (windowId: string) => {
    const element = focusHistory.get(windowId);
    if (element && document.body.contains(element)) {
      element.focus();
      return true;
    }
    return false;
  };

  const clear = (windowId: string) => {
    focusHistory.delete(windowId);
  };

  return { save, restore, clear };
}

// ─────────────────────────────────────────────────────────────────────────────
// SKIP LINKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Navigate to a landmark element
 */
export function skipToLandmark(landmark: string) {
  const element = document.querySelector<HTMLElement>(
    `[role="${landmark}"], ${landmark}`
  );
  if (element) {
    element.setAttribute("tabindex", "-1");
    element.focus();
    element.removeAttribute("tabindex");
  }
}

/**
 * Create skip link handlers
 */
export function createSkipLinks() {
  return {
    skipToMain: () => skipToLandmark("main"),
    skipToNav: () => skipToLandmark("navigation"),
    skipToSearch: () => {
      const search = document.querySelector<HTMLElement>(
        '[role="search"] input, input[type="search"]'
      );
      search?.focus();
    },
  };
}
