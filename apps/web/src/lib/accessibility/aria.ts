/**
 * ARIA Utilities
 *
 * Provides utilities for managing ARIA attributes and live regions.
 *
 * @see docs/execplans/desktop-evolution-prd.md Part XIII (Accessibility)
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type LiveRegionPoliteness = "polite" | "assertive" | "off";

export type LiveRegionOptions = {
  politeness?: LiveRegionPoliteness;
  atomic?: boolean;
  relevant?: "additions" | "removals" | "text" | "all";
};

// ─────────────────────────────────────────────────────────────────────────────
// LIVE REGION ANNOUNCER
// ─────────────────────────────────────────────────────────────────────────────

let announcer: HTMLDivElement | null = null;

/**
 * Get or create the screen reader announcer element
 */
function getAnnouncer(): HTMLDivElement {
  if (announcer) {
    return announcer;
  }

  announcer = document.createElement("div");
  announcer.setAttribute("aria-live", "polite");
  announcer.setAttribute("aria-atomic", "true");
  announcer.className = "sr-only";
  announcer.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `;
  document.body.appendChild(announcer);

  return announcer;
}

/**
 * Announce a message to screen readers
 */
export function announce(
  message: string,
  options: LiveRegionOptions = {}
): void {
  const { politeness = "polite" } = options;
  const el = getAnnouncer();

  el.setAttribute("aria-live", politeness);

  // Clear and set content to trigger announcement
  el.textContent = "";
  requestAnimationFrame(() => {
    el.textContent = message;
  });
}

/**
 * Announce an assertive (important) message
 */
export function announceAssertive(message: string): void {
  announce(message, { politeness: "assertive" });
}

// ─────────────────────────────────────────────────────────────────────────────
// ARIA ATTRIBUTE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set expanded state for collapsible elements
 */
export function setExpanded(element: HTMLElement, expanded: boolean): void {
  element.setAttribute("aria-expanded", String(expanded));
}

/**
 * Set selected state for selectable elements
 */
export function setSelected(element: HTMLElement, selected: boolean): void {
  element.setAttribute("aria-selected", String(selected));
}

/**
 * Set pressed state for toggle buttons
 */
export function setPressed(element: HTMLElement, pressed: boolean): void {
  element.setAttribute("aria-pressed", String(pressed));
}

/**
 * Set busy state for loading elements
 */
export function setBusy(element: HTMLElement, busy: boolean): void {
  element.setAttribute("aria-busy", String(busy));
}

/**
 * Set hidden state for elements
 */
export function setHidden(element: HTMLElement, hidden: boolean): void {
  element.setAttribute("aria-hidden", String(hidden));
}

/**
 * Set disabled state for elements
 */
export function setDisabled(element: HTMLElement, disabled: boolean): void {
  element.setAttribute("aria-disabled", String(disabled));
}

/**
 * Set current state for navigation items
 */
export function setCurrent(
  element: HTMLElement,
  current: "page" | "step" | "location" | "date" | "time" | "true" | "false"
): void {
  element.setAttribute("aria-current", current);
}

// ─────────────────────────────────────────────────────────────────────────────
// DESCRIBEDBY AND LABELLEDBY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add describedby reference to an element
 */
export function addDescribedBy(element: HTMLElement, id: string): void {
  const existing = element.getAttribute("aria-describedby") || "";
  const ids = existing.split(" ").filter(Boolean);
  if (!ids.includes(id)) {
    ids.push(id);
    element.setAttribute("aria-describedby", ids.join(" "));
  }
}

/**
 * Remove describedby reference from an element
 */
export function removeDescribedBy(element: HTMLElement, id: string): void {
  const existing = element.getAttribute("aria-describedby") || "";
  const ids = existing.split(" ").filter((i) => i !== id);
  if (ids.length > 0) {
    element.setAttribute("aria-describedby", ids.join(" "));
  } else {
    element.removeAttribute("aria-describedby");
  }
}

/**
 * Set labelledby reference
 */
export function setLabelledBy(element: HTMLElement, id: string): void {
  element.setAttribute("aria-labelledby", id);
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const ariaRoles = {
  // Landmarks
  banner: "banner",
  navigation: "navigation",
  main: "main",
  complementary: "complementary",
  contentinfo: "contentinfo",
  search: "search",
  region: "region",

  // Widgets
  button: "button",
  checkbox: "checkbox",
  dialog: "dialog",
  alertdialog: "alertdialog",
  listbox: "listbox",
  menu: "menu",
  menubar: "menubar",
  menuitem: "menuitem",
  option: "option",
  progressbar: "progressbar",
  radio: "radio",
  slider: "slider",
  spinbutton: "spinbutton",
  tab: "tab",
  tablist: "tablist",
  tabpanel: "tabpanel",
  textbox: "textbox",
  tooltip: "tooltip",
  tree: "tree",
  treeitem: "treeitem",

  // Document structure
  article: "article",
  group: "group",
  heading: "heading",
  list: "list",
  listitem: "listitem",
  separator: "separator",
  toolbar: "toolbar",

  // Live regions
  alert: "alert",
  log: "log",
  marquee: "marquee",
  status: "status",
  timer: "timer",
} as const;

/**
 * Set role on an element
 */
export function setRole(
  element: HTMLElement,
  role: keyof typeof ariaRoles
): void {
  element.setAttribute("role", ariaRoles[role]);
}
