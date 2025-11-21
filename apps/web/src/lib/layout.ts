import { type Node, type Edge } from "@xyflow/react";
import type { ArtifactData } from "@/store/mindscape";
import { layoutSemantic, type SemanticLayoutOptions } from "./layout-semantic";

// Simple concentric layout
export function getLayoutedElements(
  nodes: Node<ArtifactData>[],
  edges: Edge[],
  centerId = "singularity"
) {
  const center = { x: 0, y: 0 };
  const orbitSpacing = 400;
  
  // Group nodes by type
  const chats = nodes.filter(n => n.type === 'chat');
  const workflows = nodes.filter(n => n.type === 'workflow');
  const artifacts = nodes.filter(n => n.type === 'terminal' || n.type === 'artifact');
  const others = nodes.filter(n => !['chat', 'workflow', 'terminal', 'artifact', 'orb'].includes(n.type || ''));

  // Helper to layout a group in a circle/arc
  const layoutGroup = (group: Node<ArtifactData>[], radius: number, startAngle = 0) => {
    if (group.length === 0) return [];
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
  const layoutedArtifacts = layoutGroup(artifacts, orbitSpacing * 3, Math.PI / 4);

  // Others
  const layoutedOthers = layoutGroup(others, orbitSpacing * 4, 0);

  // Singularity stays at 0,0
  const singularity = nodes.find(n => n.id === centerId);
  
  return [
    ...(singularity ? [singularity] : []),
    ...layoutedChats,
    ...layoutedWorkflows,
    ...layoutedArtifacts,
    ...layoutedOthers
  ];
}

export function getSemanticLayoutedElements(
  nodes: Node<ArtifactData>[],
  edges: Edge[],
  options?: SemanticLayoutOptions
): Node<ArtifactData>[] {
  return layoutSemantic(nodes, edges, options);
}
