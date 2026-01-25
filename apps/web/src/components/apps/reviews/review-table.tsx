"use client";

/**
 * ReviewTable - Full data table with sorting, filtering, and batch actions
 * Keyboard shortcuts: j/k navigate, a approve, r reject, space select
 */

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface ReviewTableProps {
  onSelectReview: (reviewId: string) => void;
  className?: string;
}

interface Review {
  id: string;
  reviewType: string;
  subjectData: unknown;
  priority: string;
  status: string;
  createdAt: Date | null;
  confidence: number | null;
}

export function ReviewTable({ onSelectReview, className }: ReviewTableProps) {
  const utils = trpc.useUtils();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);

  const { data, isLoading } = trpc.review.queue.useQuery({
    filter: "all",
    limit: 100,
  });

  const batchApproveMutation = trpc.review.batchApprove.useMutation({
    onSuccess: () => {
      utils.review.queue.invalidate();
      utils.review.blocked.invalidate();
      utils.review.riskSummary.invalidate();
      utils.review.activityFeed.invalidate();
      setRowSelection({});
    },
  });

  const batchRejectMutation = trpc.review.batchReject.useMutation({
    onSuccess: () => {
      utils.review.queue.invalidate();
      utils.review.blocked.invalidate();
      utils.review.riskSummary.invalidate();
      utils.review.activityFeed.invalidate();
      setRowSelection({});
    },
  });

  const columns = useMemo<ColumnDef<Review>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        size: 40,
      },
      {
        accessorKey: "reviewType",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {(row.getValue("reviewType") as string).replace("_", " ")}
          </Badge>
        ),
        size: 120,
      },
      {
        id: "summary",
        header: "Summary",
        cell: ({ row }) => {
          const subjectData = row.original.subjectData as Record<
            string,
            unknown
          >;
          const summary = getSummary(row.original.reviewType, subjectData);
          return (
            <button
              className="text-left hover:underline truncate max-w-[300px] block"
              onClick={() => onSelectReview(row.original.id)}
              title={summary}
            >
              {summary}
            </button>
          );
        },
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => {
          const priority = row.getValue("priority") as string;
          const colors: Record<string, string> = {
            critical: "bg-red-500/20 text-red-400 border-red-500/40",
            high: "bg-orange-500/20 text-orange-400 border-orange-500/40",
            medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
            low: "bg-green-500/20 text-green-400 border-green-500/40",
          };
          return (
            <Badge className={colors[priority] ?? "bg-muted"} variant="outline">
              {priority}
            </Badge>
          );
        },
        size: 100,
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.getValue("createdAt")
              ? formatDistanceToNow(new Date(row.getValue("createdAt")), {
                  addSuffix: true,
                })
              : "-"}
          </span>
        ),
        size: 120,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={
              row.getValue("status") === "pending" ? "secondary" : "outline"
            }
          >
            {row.getValue("status")}
          </Badge>
        ),
        size: 100,
      },
    ],
    [onSelectReview]
  );

  const table = useReactTable({
    data: (data?.reviews as Review[]) ?? [],
    columns,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  const selectedCount = Object.keys(rowSelection).length;

  const handleBatchApprove = async () => {
    const selectedIds = table
      .getSelectedRowModel()
      .rows.map((row) => row.original.id);

    await batchApproveMutation.mutateAsync({ reviewIds: selectedIds });
  };

  const handleBatchReject = async () => {
    const selectedIds = table
      .getSelectedRowModel()
      .rows.map((row) => row.original.id);

    await batchRejectMutation.mutateAsync({ reviewIds: selectedIds });
  };

  // Single review mutations for keyboard shortcuts
  const submitMutation = trpc.review.submit.useMutation({
    onSuccess: () => {
      utils.review.queue.invalidate();
      utils.review.blocked.invalidate();
      utils.review.riskSummary.invalidate();
      utils.review.activityFeed.invalidate();
    },
  });

  const { rows } = table.getRowModel();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "j":
        case "ArrowDown": {
          e.preventDefault();
          setFocusedRowIndex((prev) =>
            prev < rows.length - 1 ? prev + 1 : prev
          );
          break;
        }
        case "k":
        case "ArrowUp": {
          e.preventDefault();
          setFocusedRowIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        }
        case " ": {
          e.preventDefault();
          const row = rows[focusedRowIndex];
          if (focusedRowIndex >= 0 && focusedRowIndex < rows.length && row) {
            row.toggleSelected();
          }
          break;
        }
        case "a": {
          const row = rows[focusedRowIndex];
          if (focusedRowIndex >= 0 && focusedRowIndex < rows.length && row) {
            submitMutation.mutate({
              reviewId: row.original.id,
              verdict: "approve",
            });
          }
          break;
        }
        case "r": {
          const row = rows[focusedRowIndex];
          if (focusedRowIndex >= 0 && focusedRowIndex < rows.length && row) {
            submitMutation.mutate({
              reviewId: row.original.id,
              verdict: "reject",
            });
          }
          break;
        }
        case "Enter": {
          const row = rows[focusedRowIndex];
          if (focusedRowIndex >= 0 && focusedRowIndex < rows.length && row) {
            onSelectReview(row.original.id);
          }
          break;
        }
      }
    },
    [focusedRowIndex, rows, onSelectReview, submitMutation]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (isLoading) {
    return <TableSkeleton className={className} />;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Input
            placeholder="Search reviews..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="max-w-sm"
          />
          <span className="text-xs text-muted-foreground hidden lg:block">
            j/k navigate · space select · a approve · r reject
          </span>
        </div>

        {selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedCount} selected
            </span>
            <Button
              size="sm"
              variant="default"
              onClick={handleBatchApprove}
              disabled={batchApproveMutation.isPending}
              aria-label={`Approve ${selectedCount} selected reviews`}
            >
              <Check className="w-4 h-4 mr-1" aria-hidden="true" />
              Approve All
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBatchReject}
              disabled={batchRejectMutation.isPending}
              aria-label={`Reject ${selectedCount} selected reviews`}
            >
              <X className="w-4 h-4 mr-1" aria-hidden="true" />
              Reject All
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div
        className="border rounded-lg overflow-hidden"
        role="region"
        aria-label="Reviews table"
      >
        <Table aria-label="Review queue">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      header.column.getCanSort() && "cursor-pointer select-none"
                    )}
                  >
                    <div
                      className="flex items-center gap-2"
                      onClick={header.column.getToggleSortingHandler()}
                      style={{ width: header.getSize() }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getIsSorted() === "asc" && (
                        <ChevronUp
                          className="w-4 h-4"
                          aria-label="Sorted ascending"
                        />
                      )}
                      {header.column.getIsSorted() === "desc" && (
                        <ChevronDown
                          className="w-4 h-4"
                          aria-label="Sorted descending"
                        />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-8 text-muted-foreground"
                >
                  No reviews found
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row, index) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "hover:bg-muted/50",
                    focusedRowIndex === index &&
                      "ring-2 ring-primary ring-inset"
                  )}
                  onClick={() => setFocusedRowIndex(index)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount() || 1}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function getSummary(
  reviewType: string,
  subjectData: Record<string, unknown>
): string {
  switch (reviewType) {
    case "tool_execution": {
      return `Tool: ${subjectData.toolName ?? "unknown"}`;
    }
    case "memory": {
      return `Memory: ${(subjectData.fact as string)?.slice(0, 50) ?? "..."}`;
    }
    case "message": {
      return `Message: ${(subjectData.messageContent as string)?.slice(0, 50) ?? "..."}`;
    }
    case "workflow": {
      return `Workflow: ${subjectData.decision ?? "decision"}`;
    }
    case "code": {
      return `PR #${subjectData.prNumber ?? "?"}: ${subjectData.prTitle ?? "Code review"}`;
    }
    default: {
      return "Review";
    }
  }
}

function TableSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <Skeleton className="h-10 w-64" />
      <div className="border rounded-lg p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
