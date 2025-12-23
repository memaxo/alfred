import type { Edge, Node } from "@xyflow/react";
import { layoutSemantic, type SemanticLayoutOptions } from "./layout-semantic";

type NodeData = { type?: string; label?: string; [key: string]: unknown };

export function getLayoutedElements<T extends NodeData>(
  nodes: Node<T>[],
  _edges: Edge[],
  centerId = "singularity"
): Node<T>[] {
  const center = { x: 0, y: 0 };
  const orbitSpacing = 400;

  // Group nodes by type
  const chats = nodes.filter((n) => n.type === "chat");
  const workflows = nodes.filter((n) => n.type === "workflow");
  const artifacts = nodes.filter(
    (n) => n.type === "terminal" || n.type === "artifact"
  );
  const others = nodes.filter(
    (n) =>
      !["chat", "workflow", "terminal", "artifact", "orb"].includes(
        n.type || ""
      )
  );

  const layoutGroup = (group: Node<T>[], radius: number, startAngle = 0) => {
    if (group.length === 0) {
      return [];
    }
    const angleStep = (2 * Math.PI) / (group.length || 1);
    return group.map((node, i) => {
      // If node has been moved by user (dragged), keep it?
      // For now, we enforce layout on "auto" trigger or init.
      // But usually we only want to layout NEW nodes.
      // Let's assume this function recalculates everything.

      const angle = startAngle + i * angleStep;
      return {
        ...node,
        position: {
          x: center.x + radius * Math.cos(angle),
          y: center.y + radius * Math.sin(angle),
        },
      };
    });
  };

  // Chat nodes in first orbit (closest)
  const layoutedChats = layoutGroup(chats, orbitSpacing, -Math.PI / 2); // Top

  // Workflows in second orbit
  const layoutedWorkflows = layoutGroup(workflows, orbitSpacing * 2, 0);

  // Artifacts in third orbit
  const layoutedArtifacts = layoutGroup(
    artifacts,
    orbitSpacing * 3,
    Math.PI / 4
  );

  // Others
  const layoutedOthers = layoutGroup(others, orbitSpacing * 4, 0);

  // Singularity stays at 0,0
  const singularity = nodes.find((n) => n.id === centerId);

  return [
    ...(singularity ? [singularity] : []),
    ...layoutedChats,
    ...layoutedWorkflows,
    ...layoutedArtifacts,
    ...layoutedOthers,
  ];
}

export function getSemanticLayoutedElements<T extends NodeData>(
  nodes: Node<T>[],
  edges: Edge[],
  options?: SemanticLayoutOptions
): Node<T>[] {
  return layoutSemantic(nodes, edges, options);
}
