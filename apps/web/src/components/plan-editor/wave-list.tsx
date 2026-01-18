/**
 * Wave List Component
 *
 * Displays waves with drag-and-drop reordering.
 */

import type { SubTask, WavePlan } from "@alfred/pipeline/schemas";

export type WaveListProps = {
  waves: WavePlan[];
  subtasks: SubTask[];
  onReorder?: (taskId: string, newIndex: number) => void;
  onEdit?: (taskId: string, updates: Partial<SubTask>) => void;
  onRemove?: (taskId: string) => void;
  onMoveToWave?: (taskId: string, waveId: string) => void;
};

export function WaveList({
  waves,
  subtasks,
  onReorder: _onReorder,
  onEdit,
  onRemove,
  onMoveToWave: _onMoveToWave,
}: WaveListProps) {
  const getTasksForWave = (waveId: string) => {
    const wave = waves.find((w) => w.id === waveId);
    if (!wave) {
      return [];
    }
    return wave.agents
      .map((agentId) => subtasks.find((t) => t.id === agentId))
      .filter((t): t is SubTask => t !== undefined);
  };

  return (
    <div className="space-y-4">
      {waves.map((wave, waveIndex) => {
        const waveTasks = getTasksForWave(wave.id);
        const deps =
          wave.dependsOn.length > 0 ? wave.dependsOn.join(", ") : "None";

        return (
          <div
            className="rounded-lg border border-gray-700 bg-gray-800 p-4"
            key={wave.id}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-blue-400 text-lg">
                  Wave {waveIndex + 1}
                </h3>
                <p className="text-gray-400 text-sm">
                  {waveTasks.length} tasks · Depends on: {deps}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {waveTasks.map((task) => (
                <div
                  className="rounded border border-gray-600 bg-gray-750 p-3 transition-colors hover:border-blue-500"
                  key={task.id}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-500 text-xs">
                          {task.id}
                        </span>
                        {task.deps.length > 0 && (
                          <span className="text-xs text-yellow-500">
                            ⚠ {task.deps.length} deps
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-gray-200 text-sm">{task.title}</p>
                      <p className="mt-1 text-gray-400 text-xs">
                        {task.requirement}
                      </p>
                    </div>

                    <div className="ml-4 flex gap-2">
                      <button
                        className="text-blue-400 text-xs hover:text-blue-300"
                        onClick={() => onEdit?.(task.id, {})}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="text-red-400 text-xs hover:text-red-300"
                        onClick={() => onRemove?.(task.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {waveTasks.length === 0 && (
                <p className="py-4 text-center text-gray-500 text-sm">
                  No tasks in this wave
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
