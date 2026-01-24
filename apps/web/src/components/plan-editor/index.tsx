/**
 * Plan Editor Main Component
 *
 * Full plan editing interface with wave list, validation, and dependency graph.
 */

import type { PlanPhaseOutput } from "@alfred/pipeline/schemas";

import { usePlanEditor } from "@/hooks/use-plan-editor";

import { DependencyGraph } from "./dependency-graph";
import { ValidationPanel } from "./validation-panel";
import { WaveList } from "./wave-list";

export type PlanEditorProps = {
  plan: PlanPhaseOutput;
  onSave?: (plan: PlanPhaseOutput) => Promise<void>;
  onExecute?: (plan: PlanPhaseOutput) => void;
  onCancel?: () => void;
};

export function PlanEditor({
  plan,
  onSave,
  onExecute,
  onCancel,
}: PlanEditorProps) {
  const editor = usePlanEditor(plan, onSave);

  const handleSave = async () => {
    if (editor.state.validation.valid) {
      await editor.actions.save();
    }
  };

  const handleExecute = () => {
    if (editor.state.validation.valid) {
      onExecute?.(editor.state.plan);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between border-gray-700 border-b bg-gray-800 px-6 py-4">
        <div>
          <h2 className="font-bold text-gray-100 text-xl">Plan Editor</h2>
          <p className="text-gray-400 text-sm">
            {editor.state.plan.waves.length} waves ·{" "}
            {editor.state.plan.subtasks.length} tasks
          </p>
        </div>

        <div className="flex items-center gap-3">
          {editor.state.modified && (
            <span className="text-xs text-yellow-500">● Unsaved changes</span>
          )}

          <button
            className="rounded bg-gray-700 px-3 py-1 text-sm hover:bg-gray-600 disabled:opacity-50"
            disabled={!editor.canUndo}
            onClick={editor.actions.undo}
            type="button"
          >
            Undo
          </button>

          <button
            className="rounded bg-gray-700 px-3 py-1 text-sm hover:bg-gray-600 disabled:opacity-50"
            disabled={!editor.canRedo}
            onClick={editor.actions.redo}
            type="button"
          >
            Redo
          </button>

          <button
            className="rounded bg-purple-700 px-3 py-1 text-sm hover:bg-purple-600"
            onClick={editor.actions.regenerateWaves}
            type="button"
          >
            Regenerate Waves
          </button>

          <button
            className="rounded bg-gray-700 px-3 py-1 text-sm hover:bg-gray-600"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>

          <button
            className="rounded bg-blue-600 px-4 py-1 text-sm hover:bg-blue-500 disabled:opacity-50"
            disabled={!editor.state.validation.valid}
            onClick={handleSave}
            type="button"
          >
            Save
          </button>

          <button
            className="rounded bg-green-600 px-4 py-1 font-semibold text-sm hover:bg-green-500 disabled:opacity-50"
            disabled={!editor.state.validation.valid}
            onClick={handleExecute}
            type="button"
          >
            Execute
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Wave List (Left) */}
        <div className="flex-1 overflow-y-auto p-6">
          <WaveList
            onEdit={editor.actions.updateTask}
            onMoveToWave={editor.actions.moveTaskToWave}
            onRemove={editor.actions.removeTask}
            onReorder={editor.actions.reorderTask}
            subtasks={editor.state.plan.subtasks}
            waves={editor.state.plan.waves}
          />
        </div>

        {/* Sidebar (Right) */}
        <aside className="w-80 overflow-y-auto border-gray-700 border-l bg-gray-850 p-4">
          <div className="space-y-4">
            <ValidationPanel
              errors={editor.state.validation.errors}
              warnings={editor.state.validation.warnings}
            />

            <DependencyGraph subtasks={editor.state.plan.subtasks} />

            <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
              <h4 className="mb-2 font-semibold text-gray-300 text-sm">
                Actions
              </h4>
              <button
                className="w-full rounded bg-gray-700 px-3 py-2 text-sm hover:bg-gray-600"
                onClick={editor.actions.reset}
                type="button"
              >
                Reset to Original
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
