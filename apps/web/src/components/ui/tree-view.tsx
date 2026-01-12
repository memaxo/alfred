import { ChevronDown, ChevronRight, File } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export type TreeNode = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  children?: TreeNode[];
  data?: Record<string, unknown>;
};

export type TreeViewProps = {
  data: TreeNode[];
  selectedId?: string;
  onSelect?: (nodeId: string, node: TreeNode) => void;
  renderLabel?: (node: TreeNode) => React.ReactNode;
  className?: string;
};

interface TreeNodeInternal extends TreeNode {
  parentIds: string[];
  children?: TreeNodeInternal[];
}

function buildTreeWithPaths(
  nodes: TreeNode[],
  parentIds: string[] = []
): TreeNodeInternal[] {
  return nodes.map((node) => {
    const extended: TreeNodeInternal = {
      ...node,
      parentIds,
      children: node.children
        ? buildTreeWithPaths(node.children, [...parentIds, node.id])
        : undefined,
    };
    return extended;
  });
}

function TreeNodeComponent({
  node,
  depth,
  selectedId,
  onSelect,
  expandedNodes,
  onToggleExpand,
  renderLabel,
}: {
  node: TreeNodeInternal;
  depth: number;
  selectedId?: string;
  onSelect?: (nodeId: string, node: TreeNode) => void;
  expandedNodes: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  renderLabel?: (node: TreeNode) => React.ReactNode;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedId === node.id;

  const handleClick = () => {
    if (hasChildren) {
      onToggleExpand(node.id);
    }
    onSelect?.(node.id, node);
  };

  const defaultIcon = hasChildren ? (
    isExpanded ? (
      <ChevronDown className="h-4 w-4" />
    ) : (
      <ChevronRight className="h-4 w-4" />
    )
  ) : (
    <File className="h-4 w-4" />
  );

  return (
    <div>
      <button
        className={cn(
          "flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-sm transition-colors",
          "hover:bg-void-surface/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biolum",
          isSelected && "bg-biolum/10 text-biolum"
        )}
        onClick={handleClick}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        type="button"
      >
        <span className="shrink-0 text-biolum-dim">
          {node.icon ?? defaultIcon}
        </span>
        {renderLabel ? renderLabel(node) : node.label}
      </button>
      {isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNodeComponent
              depth={depth + 1}
              expandedNodes={expandedNodes}
              key={child.id}
              node={child as TreeNodeInternal}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              renderLabel={renderLabel}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const TreeView = ({
  data,
  selectedId,
  onSelect,
  renderLabel,
  className,
  ref,
}: TreeViewProps & {
  ref?: React.RefObject<HTMLDivElement | null>;
}) => {
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(
    () => new Set()
  );

  const handleToggleExpand = React.useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const treeWithPaths = React.useMemo(() => buildTreeWithPaths(data), [data]);

  return (
    <div className={cn("w-full", className)} ref={ref}>
      {treeWithPaths.map((node) => (
        <TreeNodeComponent
          depth={0}
          expandedNodes={expandedNodes}
          key={node.id}
          node={node}
          onSelect={onSelect}
          onToggleExpand={handleToggleExpand}
          renderLabel={renderLabel}
          selectedId={selectedId}
        />
      ))}
    </div>
  );
};

TreeView.displayName = "TreeView";
