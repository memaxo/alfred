/**
 * Accessibility Components
 *
 * Re-exports all accessibility components and hooks for the desktop shell.
 */

export { type ContextInfo, ContextLens } from "./context-lens";
export { FocusIndicator } from "./focus-indicator";
export {
  useAnnounce,
  useFocusRestoration,
  useFocusTrap,
  useHighContrast,
  useKeyboardNavigation,
  useReducedMotion,
} from "./hooks";
export { SkipLinks } from "./skip-links";
