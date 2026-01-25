import type { WindowType } from "@/store/desktop.types";

export interface WindowParity {
  /**
   * Canonical reference implementation in the web app.
   *
   * - `app`: `apps/web/src/components/apps/<name>`
   * - `window`: `apps/web/src/components/windows/<name>`
   */
  readonly kind: "app" | "window";
  /**
   * File path relative to `apps/web/src/`.
   */
  readonly webPath: string;
  /**
   * Primary server routers this surface depends on.
   *
   * (Router names match `packages/api/src/routers/*` filenames.)
   */
  readonly routers: readonly string[];
  /**
   * Minimal iOS “not a stub” contract:
   * render real data (or empty state) and support at least one core action.
   */
  readonly contract: readonly string[];
}

export const windowParity: Record<WindowType, WindowParity> = {
  chat: {
    kind: "app",
    webPath: "components/apps/chat/index.tsx",
    routers: ["assistant", "orchestrator", "voice"],
    contract: ["send_message", "toggle_voice", "render_tool_parts"],
  },
  inbox: {
    kind: "app",
    webPath: "components/apps/inbox/index.tsx",
    routers: ["inbox"],
    contract: ["list_items", "open_item"],
  },
  terminal: {
    kind: "app",
    webPath: "components/apps/terminal/index.tsx",
    routers: ["terminal"],
    contract: ["list_sessions_or_history", "run_command_or_send_input"],
  },
  code: {
    kind: "app",
    webPath: "components/apps/code/index.tsx",
    routers: ["codex", "workflow"],
    contract: ["render_artifacts_or_files", "open_artifact"],
  },
  codex: {
    kind: "app",
    webPath: "components/apps/codex/index.tsx",
    routers: ["codex", "codex-intent"],
    contract: ["list_threads", "send_message"],
  },
  agents: {
    kind: "app",
    webPath: "components/apps/agents/index.tsx",
    routers: ["workflow", "orchestrator"],
    contract: ["list_runs_or_waves", "open_run"],
  },
  taskmanager: {
    kind: "app",
    webPath: "components/apps/taskmanager/index.tsx",
    routers: ["workflow", "trajectory"],
    contract: ["list_active_work", "open_item"],
  },
  docker: {
    kind: "app",
    webPath: "components/apps/docker/index.tsx",
    routers: ["runtime", "deploy"],
    contract: ["show_runtime_status", "trigger_action"],
  },
  "pr-review": {
    kind: "app",
    webPath: "components/apps/pr-review/index.tsx",
    routers: ["github"],
    contract: ["load_pr", "render_diff"],
  },
  agentfs: {
    kind: "app",
    webPath: "components/apps/agentfs/index.tsx",
    routers: ["agentfs", "fs"],
    contract: ["browse_workspace", "open_file"],
  },
  files: {
    kind: "app",
    webPath: "components/apps/files/index.tsx",
    routers: ["fs"],
    contract: ["browse_files", "open_file"],
  },
  admin: {
    kind: "app",
    webPath: "components/apps/admin/index.tsx",
    routers: ["admin", "runtime"],
    contract: ["show_status", "run_admin_action"],
  },
  cortex: {
    kind: "app",
    webPath: "components/apps/cortex/index.tsx",
    routers: ["cognitive", "metrics"],
    contract: ["render_state", "refresh"],
  },
  learning: {
    kind: "app",
    webPath: "components/apps/learning/index.tsx",
    routers: ["cognitive", "eval"],
    contract: ["render_insights", "refresh"],
  },
  policy: {
    kind: "app",
    webPath: "components/apps/policy/index.tsx",
    routers: ["privacy", "policy"],
    contract: ["render_policy", "toggle_setting"],
  },
  tune: {
    kind: "app",
    webPath: "components/apps/tune/index.tsx",
    routers: ["tune"],
    contract: ["render_controls", "save_setting"],
  },
  plan: {
    kind: "app",
    webPath: "components/apps/plan/index.tsx",
    routers: ["plan", "workflow"],
    contract: ["render_plan", "generate_or_update"],
  },
  "visual-builder": {
    kind: "window",
    webPath: "components/windows/visual-builder/visual-builder-window.tsx",
    routers: ["visual", "workflow"],
    contract: ["render_builder", "save_or_run"],
  },
  metrics: {
    kind: "app",
    webPath: "components/apps/metrics/index.tsx",
    routers: ["metrics"],
    contract: ["render_metrics", "refresh"],
  },
  rag: {
    kind: "app",
    webPath: "components/apps/rag/index.tsx",
    routers: ["rag", "knowledge"],
    contract: ["render_queries", "run_query"],
  },
  bookmarks: {
    kind: "app",
    webPath: "components/apps/bookmarks/index.tsx",
    routers: ["book"],
    contract: ["list_bookmarks", "open_bookmark"],
  },
  timers: {
    kind: "app",
    webPath: "components/apps/timers/index.tsx",
    routers: ["timer"],
    contract: ["list_timers", "start_or_stop"],
  },
  knowledge: {
    kind: "app",
    webPath: "components/apps/knowledge/index.tsx",
    routers: ["knowledge", "graph"],
    contract: ["render_graph_or_facts", "search"],
  },
  workflow: {
    kind: "window",
    webPath: "components/windows/workflow/workflow-window.tsx",
    routers: ["workflow"],
    contract: ["load_run", "stream_events_or_steps"],
  },
  linear: {
    kind: "app",
    webPath: "components/apps/linear/index.tsx",
    routers: ["linear"],
    contract: ["list_issues", "open_issue"],
  },
  concept: {
    kind: "window",
    webPath: "components/windows/concept/concept-window.tsx",
    routers: ["graph", "knowledge"],
    contract: ["render_concepts", "open_concept"],
  },
  project: {
    kind: "window",
    webPath: "components/windows/project/project-window.tsx",
    routers: ["project"],
    contract: ["list_projects", "open_project"],
  },
  settings: {
    kind: "app",
    webPath: "components/apps/settings/index.tsx",
    routers: ["preference", "notification", "privacy"],
    contract: ["render_sections", "save_preference"],
  },
  components: {
    kind: "app",
    webPath: "components/apps/components/index.tsx",
    routers: [],
    contract: ["render_gallery", "preview_component"],
  },
  workingset: {
    kind: "app",
    webPath: "components/apps/workingset/index.tsx",
    routers: ["workingset"],
    contract: ["render_workingset", "add_or_remove_item"],
  },
  notes: {
    kind: "app",
    webPath: "components/apps/notes/index.tsx",
    routers: ["note"],
    contract: ["list_notes", "create_note", "open_note"],
  },
  note: {
    kind: "window",
    webPath: "components/windows/note/note-window.tsx",
    routers: ["note"],
    contract: ["view_note", "edit_note", "delete_note"],
  },
  reminders: {
    kind: "window",
    webPath: "components/windows/reminder/reminder-window.tsx",
    routers: ["remind"],
    contract: ["list_reminders", "create_or_edit", "fire_or_delete"],
  },
  reminder: {
    kind: "window",
    webPath: "components/windows/reminder/reminder-window.tsx",
    routers: ["remind"],
    contract: ["view_reminder", "edit_reminder", "fire_or_delete"],
  },
  todos: {
    kind: "window",
    webPath: "components/windows/todo/todo-window.tsx",
    routers: ["task"],
    contract: ["list_tasks", "create_task", "toggle_complete"],
  },
  todo: {
    kind: "window",
    webPath: "components/windows/todo/todo-window.tsx",
    routers: ["task"],
    contract: ["list_tasks", "create_task", "toggle_complete"],
  },
  workflowlist: {
    kind: "window",
    webPath: "components/windows/workflow/workflow-list-window.tsx",
    routers: ["workflow"],
    contract: ["list_runs", "open_run"],
  },
  integrations: {
    kind: "window",
    webPath: "components/windows/integrations/integrations-window.tsx",
    routers: ["integration"],
    contract: ["list_integrations", "connect_or_disconnect"],
  },
  droid: {
    kind: "window",
    webPath: "components/windows/droid/droid-window.tsx",
    routers: ["droids"],
    contract: ["render_status", "run_action"],
  },
} as const;
