/**
 * Issue List - Virtualized Linear issue list
 */

import { AlertCircle, CheckCircle, Circle } from "lucide-react";

import { VirtualList } from "@/components/ui/virtual-list";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

import { useLinear } from "./context";

interface IssueListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  priority: number;
  state: { id: string; name: string; color: string } | null;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  labels: { id: string; name: string; color: string }[];
  createdAt: string;
  updatedAt: string;
}

function mapStateName(
  name: string | undefined
): "backlog" | "todo" | "in_progress" | "done" | "cancelled" {
  if (!name) {
    return "backlog";
  }
  const lower = name.toLowerCase();
  if (lower.includes("done") || lower.includes("complete")) {
    return "done";
  }
  if (lower.includes("progress") || lower.includes("started")) {
    return "in_progress";
  }
  if (lower.includes("todo") || lower.includes("ready")) {
    return "todo";
  }
  if (lower.includes("cancel")) {
    return "cancelled";
  }
  return "backlog";
}

const statusIcons = {
  backlog: Circle,
  todo: Circle,
  in_progress: AlertCircle,
  done: CheckCircle,
  cancelled: Circle,
};

const statusColors = {
  backlog: "text-biolum-dim",
  todo: "text-biolum-dim",
  in_progress: "text-yellow-400",
  done: "text-green-400",
  cancelled: "text-red-400",
};

const priorityColors: Record<number, string> = {
  0: "bg-biolum-dim/20",
  1: "bg-red-500/20 text-red-400",
  2: "bg-orange-500/20 text-orange-400",
  3: "bg-yellow-500/20 text-yellow-400",
  4: "bg-blue-500/20 text-blue-400",
};

export function IssueList({ selectedId, onSelect, className }: IssueListProps) {
  const { selectedTeamId, stateFilter } = useLinear();

  const { data, isLoading, error } = trpc.linear.issuesList.useQuery({
    limit: 50,
    teamId: selectedTeamId ?? undefined,
    state: stateFilter ?? undefined,
  });

  const issues = data?.issues ?? [];

  const errorMsg = error
    ? (error.message === "linear_not_connected"
      ? "Linear not connected. Connect via Settings."
      : error.message)
    : null;

  return (
    <VirtualList
      className={className}
      data={issues}
      emptyMessage="No issues found"
      error={errorMsg}
      headerText={`${issues.length} Issues`}
      isLoading={isLoading}
      renderItem={(issue: LinearIssue) => (
        <IssueRow
          isSelected={issue.id === selectedId}
          issue={issue}
          onClick={() => onSelect(issue.id)}
        />
      )}
    />
  );
}

function IssueRow({
  issue,
  isSelected,
  onClick,
}: {
  issue: LinearIssue;
  isSelected: boolean;
  onClick: () => void;
}) {
  const status = mapStateName(issue.state?.name);
  const StatusIcon = statusIcons[status];

  return (
    <button
      className={cn(
        "mb-1 w-full rounded-lg p-2 text-left transition-colors",
        isSelected ? "bg-biolum/10 text-biolum" : "hover:bg-white/5"
      )}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start gap-2">
        <StatusIcon className={cn("mt-0.5 h-4 w-4", statusColors[status])} />
        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="font-medium text-biolum-dim text-xs">
              {issue.identifier}
            </span>
            <span
              className={cn(
                "rounded px-1 text-xs",
                priorityColors[issue.priority] ?? priorityColors[0]
              )}
            >
              P{issue.priority}
            </span>
          </div>
          <p className="truncate text-sm">{issue.title}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {issue.labels.map((label) => (
              <span
                className="rounded bg-white/10 px-1.5 py-0.5 text-biolum-dim text-xs"
                key={label.id}
              >
                {label.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
