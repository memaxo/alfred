/**
 * Task Card Component
 *
 * Displays individual task with editing capabilities.
 */

import type { SubTask } from "@alfred/pipeline/schemas";

export type TaskCardProps = {
  task: SubTask;
  onEdit?: (updates: Partial<SubTask>) => void;
  onRemove?: () => void;
  selected?: boolean;
};

export function TaskCard({
  task,
  onEdit,
  onRemove,
  selected = false,
}: TaskCardProps) {
  return (
    <div
      className={`rounded border p-3 transition-all ${
        selected
          ? "border-blue-500 bg-blue-950"
          : "border-gray-600 bg-gray-750 hover:border-blue-500"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-gray-500 text-xs">{task.id}</span>
            {task.deps.length > 0 && (
              <span className="text-xs text-yellow-500">
                {task.deps.length} dependencies
              </span>
            )}
          </div>

          <p className="mt-1 text-gray-200 text-sm">{task.title}</p>
          <p className="mt-1 text-gray-400 text-xs">{task.requirement}</p>

          {task.deps.length > 0 && (
            <div className="mt-2 text-gray-400 text-xs">
              Depends on: {task.deps.join(", ")}
            </div>
          )}
        </div>

        <div className="ml-4 flex gap-2">
          <button
            className="text-blue-400 text-xs hover:text-blue-300"
            onClick={() => onEdit?.({})}
            type="button"
          >
            Edit
          </button>
          <button
            className="text-red-400 text-xs hover:text-red-300"
            onClick={onRemove}
            type="button"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
