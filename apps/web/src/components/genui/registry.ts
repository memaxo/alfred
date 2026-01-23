/**
 * GenUI Component Registry for ALFRED Web
 *
 * Maps manifest component names to actual React implementations.
 * Call initGenUIRegistry() at app initialization to register
 * components with the genui interpreter.
 *
 * Components are grouped by category and can be registered
 * selectively based on application needs.
 */

import {
  ArtifactBrowser,
  ErrorPanel,
  ProgressWindow,
  ResourceMonitor,
  registerComponents,
  StreamingTerminal,
  TaskTracker,
  WorkflowTimeline,
} from "@alfred/ui/genui";

// Lazy import functions for code splitting
const importChart = () => import("@/components/chart").then((m) => m.Chart);
const importGrid = () => import("@/components/grid").then((m) => m.Grid);
const importList = () => import("@/components/list").then((m) => m.List);
const importNumber = () => import("@/components/number").then((m) => m.Number);
const importTerm = () => import("@/components/term").then((m) => m.Term);
const importCode = () => import("@/components/code").then((m) => m.Code);
const importPlan = () => import("@/components/plan").then((m) => m.Plan);
const importTask = () => import("@/components/task").then((m) => m.Task);
const importLoading = () =>
  import("@/components/loading").then((m) => m.Loading);

// Form components
const importGenUIText = () =>
  import("@/components/genui/components/text").then((m) => m.GenUIText);
const importGenUISelect = () =>
  import("@/components/genui/components/select").then((m) => m.GenUISelect);
const importGenUIDate = () =>
  import("@/components/genui/components/date").then((m) => m.GenUIDate);
const importGenUICheckbox = () =>
  import("@/components/genui/components/checkbox").then((m) => m.GenUICheckbox);
const importGenUIChoice = () =>
  import("@/components/genui/components/choice").then((m) => m.GenUIChoice);
const importGenUIAutocomplete = () =>
  import("@/components/genui/components/autocomplete").then(
    (m) => m.GenUIAutocomplete
  );
const importGenUIDropdown = () =>
  import("@/components/genui/components/dropdown").then((m) => m.GenUIDropdown);
const importGenUIDaterange = () =>
  import("@/components/genui/components/daterange").then(
    (m) => m.GenUIDaterange
  );

// Track initialization state
let initialized = false;

/**
 * Initialize the GenUI registry with ALFRED's component library.
 *
 * This function should be called once at app startup.
 * It eagerly imports core visualization components for GenUI.
 *
 * @example
 * ```tsx
 * // In app initialization
 * import { initGenUIRegistry } from "@/components/genui/registry";
 *
 * // Call early in app lifecycle
 * await initGenUIRegistry();
 * ```
 */
export async function initGenUIRegistry(): Promise<void> {
  if (initialized) {
    return;
  }

  // Import core components in parallel for GenUI rendering
  const [
    Chart,
    Grid,
    List,
    SlidingNumber,
    Term,
    Code,
    Plan,
    Task,
    Loading,
    GenUIText,
    GenUISelect,
    GenUIDate,
    GenUICheckbox,
    GenUIChoice,
    GenUIAutocomplete,
    GenUIDropdown,
    GenUIDaterange,
  ] = await Promise.all([
    importChart(),
    importGrid(),
    importList(),
    importNumber(),
    importTerm(),
    importCode(),
    importPlan(),
    importTask(),
    importLoading(),
    importGenUIText(),
    importGenUISelect(),
    importGenUIDate(),
    importGenUICheckbox(),
    importGenUIChoice(),
    importGenUIAutocomplete(),
    importGenUIDropdown(),
    importGenUIDaterange(),
  ]);

  // Register with genui interpreter
  registerComponents({
    // Data Visualization
    chart: Chart,
    grid: Grid,
    list: List,
    number: SlidingNumber,

    // Terminal/Code
    term: Term,
    code: Code,

    // AI Elements
    plan: Plan,
    task: Task,

    // Feedback
    loading: Loading,

    // Orchestrator Components (from @alfred/ui/genui)
    "streaming-terminal": StreamingTerminal,
    "progress-window": ProgressWindow,
    "workflow-timeline": WorkflowTimeline,
    "task-tracker": TaskTracker,
    "error-panel": ErrorPanel,
    "artifact-browser": ArtifactBrowser,
    "resource-monitor": ResourceMonitor,

    // Form Components
    text: GenUIText,
    select: GenUISelect,
    date: GenUIDate,
    checkbox: GenUICheckbox,
    choice: GenUIChoice,
    autocomplete: GenUIAutocomplete,
    dropdown: GenUIDropdown,
    daterange: GenUIDaterange,
  });

  initialized = true;
}

/**
 * Check if the GenUI registry has been initialized.
 */
export function isGenUIInitialized(): boolean {
  return initialized;
}

/**
 * Reset the initialization state.
 * Primarily useful for testing.
 */
export function resetGenUIRegistry(): void {
  initialized = false;
}
