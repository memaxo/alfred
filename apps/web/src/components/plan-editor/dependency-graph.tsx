/**
 * Dependency Graph Component
 *
 * Visual dependency view using simple text representation.
 */

import type { SubTask } from "@alfred/pipeline/schemas";

export type DependencyGraphProps = {
  subtasks: SubTask[];
};

export function DependencyGraph({ subtasks }: DependencyGraphProps) {
  // Build dependency map
  const depMap = new Map<string, string[]>();
  const reverseDeps = new Map<string, string[]>();

  for (const task of subtasks) {
    depMap.set(task.id, task.deps);
    for (const depId of task.deps) {
      const rev = reverseDeps.get(depId) ?? [];
      rev.push(task.id);
      reverseDeps.set(depId, rev);
    }
  }

  // Find root tasks (no dependencies)
  const roots = subtasks.filter((t) => t.deps.length === 0);

  // Find leaf tasks (no dependents)
  const leaves = subtasks.filter((t) => !reverseDeps.has(t.id));

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
      <h4 className="mb-3 font-semibold text-gray-300 text-sm">
        Dependency Graph
      </h4>

      <div className="space-y-4 text-xs">
        <div>
          <p className="mb-1 text-gray-400">Root Tasks ({roots.length}):</p>
          <div className="space-y-1">
            {roots.map((task) => (
              <div className="font-mono text-gray-300" key={task.id}>
                → {task.id}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-gray-400">Leaf Tasks ({leaves.length}):</p>
          <div className="space-y-1">
            {leaves.map((task) => (
              <div className="font-mono text-gray-300" key={task.id}>
                ← {task.id}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-gray-400">Dependencies:</p>
          <div className="space-y-1">
            {subtasks
              .filter((t) => t.deps.length > 0)
              .map((task) => (
                <div className="font-mono text-gray-300" key={task.id}>
                  {task.id} ← {task.deps.join(", ")}
                </div>
              ))}
          </div>
        </div>

        <div className="mt-3 border-gray-700 border-t pt-3">
          <p className="text-gray-400">
            Total: {subtasks.length} tasks, {roots.length} roots,{" "}
            {leaves.length} leaves
          </p>
        </div>
      </div>
    </div>
  );
}
