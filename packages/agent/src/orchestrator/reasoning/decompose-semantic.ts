import type { ContextBundle } from "@alfred/type/plan";
import type { SubTask } from "../multi/decompose";

// Re-export types from decompose for convenience
type Bucket = "backend" | "frontend" | "test" | "misc";

type FileNode = {
  path: string;
  imports: string[];
  importedBy: string[];
  layer: Bucket;
};

type FeatureCluster = {
  name: string;
  files: string[];
  layer: Bucket;
  dependencies: Set<string>; // Names of other clusters this depends on
};

/**
 * Simple regex-based import parser for MVP.
 * Supports TS/JS imports:
 * - import ... from "..."
 * - require("...")
 */
function parseImports(content: string): string[] {
  const imports: string[] = [];
  // Regex for static imports
  const importRegex = /import\s+(?:[\s\S]*?from\s+)?["']([^"']+)["']/g;
  // Regex for dynamic imports and require
  const dynamicRegex = /(?:import|require)\(["']([^"']+)["']\)/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    if (match[1]) {
      imports.push(match[1]);
    }
  }
  while ((match = dynamicRegex.exec(content)) !== null) {
    if (match[1]) {
      imports.push(match[1]);
    }
  }
  return imports;
}

function classifyPath(path: string): Bucket {
  const lower = path.toLowerCase();
  if (
    lower.includes("/api/") ||
    lower.includes("/server/") ||
    lower.includes("/backend/") ||
    lower.endsWith(".server.ts") ||
    lower.endsWith(".server.tsx") ||
    lower.includes("/db/") ||
    lower.includes("/schema/")
  ) {
    return "backend";
  }
  if (
    lower.includes("/app/") ||
    lower.includes("/pages/") ||
    lower.includes("/components/") ||
    lower.endsWith(".client.tsx") ||
    lower.endsWith(".tsx") ||
    lower.includes("/ui/")
  ) {
    return "frontend";
  }
  if (
    lower.includes("__tests__") ||
    lower.endsWith(".test.ts") ||
    lower.endsWith(".spec.ts") ||
    lower.endsWith(".test.tsx") ||
    lower.endsWith(".spec.tsx")
  ) {
    return "test";
  }
  return "misc";
}

function resolveImportPath(
  basePath: string,
  importPath: string,
  allFiles: Set<string>
): string | null {
  if (!importPath.startsWith(".")) {
    return null; // Ignore node_modules for now
  }

  // Simple resolution for relative paths
  // This is brittle without full resolution logic, but serves MVP
  try {
    // Node path resolution simulation
    // We just want to check if the resolved path exists in our known files
    // We don't have a real file system here, just strings.
    // TODO: Implement proper path joining logic without 'path' module or use standard import?
    // We can assume posix paths for now as we normalize everything.
    const parts = basePath.split("/");
    parts.pop(); // remove filename
    const importParts = importPath.split("/");

    for (const part of importParts) {
      if (part === ".") {
        continue;
      }
      if (part === "..") {
        parts.pop();
      } else {
        parts.push(part);
      }
    }

    const resolved = parts.join("/");

    // Try exact match, .ts, .tsx, /index.ts
    const candidates = [
      resolved,
      `${resolved}.ts`,
      `${resolved}.tsx`,
      `${resolved}/index.ts`,
      `${resolved}/index.tsx`,
    ];

    for (const cand of candidates) {
      if (allFiles.has(cand)) {
        return cand;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function analyzeDependencyGraph(
  bundle: ContextBundle
): Map<string, FileNode> {
  const graph = new Map<string, FileNode>();
  const allFiles = new Set(bundle.files.map((f) => f.path));

  for (const file of bundle.files) {
    if (!file.path) {
      continue;
    }

    const imports = file.content ? parseImports(file.content) : [];

    graph.set(file.path, {
      path: file.path,
      imports,
      importedBy: [],
      layer: classifyPath(file.path),
    });
  }

  // Resolve edges
  for (const [path, node] of graph.entries()) {
    const resolvedImports: string[] = [];
    for (const imp of node.imports) {
      const target = resolveImportPath(path, imp, allFiles);
      if (target) {
        resolvedImports.push(target);
        const targetNode = graph.get(target);
        if (targetNode) {
          targetNode.importedBy.push(path);
        }
      }
    }
    node.imports = resolvedImports;
  }

  return graph;
}

export function clusterFeatures(
  graph: Map<string, FileNode>
): FeatureCluster[] {
  // Heuristic: Group files that are densely connected.
  // For MVP: Group by directory proximity + dependency chain.
  // Actually, let's stick to a simpler "Vertical Slice" heuristic:
  // 1. Identify "Entry Points" (e.g. page routes, api handlers) -> These define features.
  // 2. Trace dependencies downwards.
  // 3. If a file is shared by many features, it's "Shared/Core".

  // But often we want to split by Layer first (Backend vs Frontend) but order them by dependency.
  // i.e. Backend Task -> Frontend Task.

  // Let's identify "Backend" cluster and "Frontend" cluster, but ensuring Backend comes first.
  // And if there are multiple distinct areas (e.g. /auth vs /products), split them.

  const clusters: Map<string, FeatureCluster> = new Map();

  // Group by top-level feature folder?
  // e.g. packages/auth, apps/web/routes/login

  for (const [path, node] of graph.entries()) {
    // Determine "Feature Context"
    // e.g. packages/auth -> "auth"
    // apps/web/src/routes/mindscape -> "mindscape"
    let featureName = "core";
    if (path.includes("/auth")) {
      featureName = "auth";
    } else if (path.includes("/mindscape")) {
      featureName = "mindscape";
    } else if (path.includes("/voice")) {
      featureName = "voice";
    } else {
      // Fallback to layer generic
      featureName = node.layer;
    }

    const clusterKey = `${featureName}:${node.layer}`;

    if (!clusters.has(clusterKey)) {
      clusters.set(clusterKey, {
        name: clusterKey,
        files: [],
        layer: node.layer,
        dependencies: new Set(),
      });
    }

    clusters.get(clusterKey)?.files.push(path);
  }

  // Determine dependencies between clusters
  for (const [key, cluster] of clusters.entries()) {
    for (const file of cluster.files) {
      const node = graph.get(file);
      if (!node) {
        continue;
      }
      for (const imp of node.imports) {
        const impNode = graph.get(imp);
        if (!impNode) {
          continue;
        }

        // Find which cluster impNode belongs to
        // This is slow (O(N*M)), optimize by map lookup if needed
        for (const [otherKey, otherCluster] of clusters.entries()) {
          if (key === otherKey) {
            continue;
          }
          if (otherCluster.files.includes(imp)) {
            cluster.dependencies.add(otherKey);
          }
        }
      }
    }
  }

  return Array.from(clusters.values());
}

export function decomposeSemantically(
  requirement: string,
  bundle: ContextBundle
): SubTask[] {
  const graph = analyzeDependencyGraph(bundle);
  const clusters = clusterFeatures(graph);

  const tasks: SubTask[] = [];

  // Sort clusters topologically?
  // Or simply Backend < Frontend.
  // And Shared < Feature.

  // Priority scoring:
  // Backend = 1.0
  // Frontend = 0.8
  // Test = 0.5
  // If B depends on A, A must have higher priority?
  // Actually in `decompose.ts` priority 1 is higher than 0.5.

  // Let's map clusters to SubTasks
  for (const cluster of clusters) {
    // Generate Stable ID
    let h1 = 0x81_1c_9d_c5;
    const seed = `${requirement}|${cluster.name}`;
    for (let i = 0; i < seed.length; i++) {
      h1 ^= seed.charCodeAt(i) & 0xff;
      h1 = (h1 * 0x01_00_01_93) >>> 0;
    }
    const id = `T${(h1 >>> 0).toString(16)}`;

    const priority =
      cluster.layer === "backend"
        ? 1
        : cluster.layer === "frontend"
          ? 0.9
          : 0.5;

    tasks.push({
      id,
      title: `Implement ${cluster.name.replace(":", " ")}`,
      requirement, // Inherit base req, or refine? Refine ideally.
      deps: [], // Filled later
      priority,
      acceptance: [`${cluster.name} functionality verified.`],
      filesHint: cluster.files,
    });
  }

  // Wire dependencies
  // If cluster A depends on cluster B, Task A depends on Task B.
  // Wait, if A imports B, then B must exist first?
  // Usually yes. Backend (API) is imported by Frontend.
  // So Frontend depends on Backend.
  // So Frontend Task depends on Backend Task.

  for (const cluster of clusters) {
    const task = tasks.find((t) =>
      t.title.includes(cluster.name.replace(":", " "))
    );
    if (!task) {
      continue;
    }

    for (const depName of cluster.dependencies) {
      const depTask = tasks.find((t) =>
        t.title.includes(depName.replace(":", " "))
      );
      if (depTask) {
        task.deps.push(depTask.id);
      }
    }
  }

  return tasks;
}
