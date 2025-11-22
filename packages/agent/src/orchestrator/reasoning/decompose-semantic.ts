import type { ContextBundle } from "@alfred/type/plan";
import type { SubTask } from "../multi/decompose";

/**
 * Analyze dependency graph from file contents
 * Returns an adjacency list: file -> dependencies
 */
export function analyzeDependencyGraph(
  files: Array<{ path: string; content: string }>
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  const fileMap = new Map<string, string>(); // basename -> fullpath mapping for simplified resolution

  // Build file map
  for (const file of files) {
    graph.set(file.path, new Set());
    const basename = file.path
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/, ""); // Remove extension
    if (basename) {
      fileMap.set(basename, file.path);
    }
  }

  // Analyze imports
  for (const file of files) {
    const deps = graph.get(file.path)!;
    const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
    const content = file.content;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];

      // Simple resolution heuristic
      if (importPath && importPath.startsWith(".")) {
      } else {
        // Check if it matches a known file basename (heuristic for project imports)
        const basename = importPath ? importPath.split("/").pop() : undefined;
        if (basename && fileMap.has(basename)) {
          deps.add(fileMap.get(basename)!);
        }
      }
    }
  }

  return graph;
}

/**
 * Cluster files into feature groups based on dependency graph
 *
 * Uses a simple connected components or community detection approach.
 * For MVP, we group by directory structure but respecting cross-module deps.
 */
export function clusterFeatures(
  graph: Map<string, Set<string>>
): Map<string, Set<string>> {
  const clusters = new Map<string, Set<string>>();

  // Initialize clusters by top-level directory
  for (const [file] of graph) {
    // const parts = file.split("/");
    // e.g. packages/api/src/routers/user.ts -> api
    // e.g. apps/web/src/components/user.tsx -> web
    let clusterName = "misc";

    if (file.includes("packages/")) {
      const match = file.match(/packages\/([^/]+)/);
      if (match) clusterName = match[1] ?? "misc";
    } else if (file.includes("apps/")) {
      const match = file.match(/apps\/([^/]+)/);
      if (match) clusterName = match[1] ?? "misc";
    }

    if (!clusters.has(clusterName)) {
      clusters.set(clusterName, new Set());
    }
    clusters.get(clusterName)!.add(file);
  }

  // Merge clusters if strong dependencies exist?
  // For now, keep it simple: package/app level clustering is a good start for semantic decomposition
  // vs the previous "backend/frontend" bucket which lost the package context.

  return clusters;
}

/**
 * Decompose task semantically based on file structure and dependencies
 */
export function decomposeSemantically(
  requirement: string,
  bundle: ContextBundle
): SubTask[] {
  const filesWithContent = bundle.files
    .filter((f) => f.path && f.content)
    .map((f) => ({ path: f.path!, content: f.content! }));

  if (filesWithContent.length === 0) {
    return [];
  }

  const graph = analyzeDependencyGraph(filesWithContent);
  const clusters = clusterFeatures(graph);

  const tasks: SubTask[] = [];

  // Create a task for each cluster
  for (const [name, files] of clusters) {
    const id = `task_${name}`;

    // Determine priority based on dependencies (heuristic)
    // core/db/types usually higher priority than ui/web
    let priority = 0.5;
    if (name === "db" || name === "type" || name === "core") priority = 1.0;
    else if (name === "api" || name === "runtime") priority = 0.9;
    else if (name === "web" || name === "native") priority = 0.8;

    tasks.push({
      id,
      title: `Implement ${name} changes`,
      requirement,
      deps: [], // TODO: Infer task dependencies from file graph
      priority,
      acceptance: [`${name} changes implemented and verified`],
      filesHint: Array.from(files)
        .map((f) => {
          const dir = f.substring(0, f.lastIndexOf("/"));
          return dir;
        })
        .filter((v, i, a) => a.indexOf(v) === i), // Unique dirs
    });
  }

  // Infer dependencies between tasks
  // If cluster A imports from cluster B, A depends on B
  for (const [nameA, filesA] of clusters) {
    for (const fileA of filesA) {
      const deps = graph.get(fileA);
      if (deps) {
        for (const dep of deps) {
          // Find which cluster dep belongs to
          for (const [nameB, filesB] of clusters) {
            if (nameA !== nameB && filesB.has(dep)) {
              // A depends on B
              const taskA = tasks.find((t) => t.id === `task_${nameA}`);
              if (taskA && !taskA.deps.includes(`task_${nameB}`)) {
                taskA.deps.push(`task_${nameB}`);
              }
            }
          }
        }
      }
    }
  }

  return tasks.sort((a, b) => b.priority - a.priority);
}
