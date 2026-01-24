/**
 * GenUI Data Transforms
 *
 * Transform API data schemas into component props format.
 * Each transform handles the mapping from API schema to component props.
 */

import type {
  ChartSchema,
  GridSchema,
  ListSchema,
  NumberSchema,
  ProgressSchema,
  TimelineSchema,
  TaskSchema,
  PlanSchema,
  GenUIBaseSchema,
} from "./types";

// Chart data transform
export function transformChartData(props: ChartSchema["props"]) {
  const { data, type = "line", xLabel, yLabel, title } = props;

  return {
    data: data.map((point, index) => ({
      x: typeof point.x === "number" ? point.x : index,
      y: point.y,
    })),
    type,
    xLabel,
    yLabel,
    title,
  };
}

// Grid data transform
export function transformGridData(props: GridSchema["props"]) {
  const { columns, data, showHeader = true, striped = false } = props;

  return {
    columns: columns.map((col) => ({
      key: col.key,
      header: col.header,
      width: col.width,
    })),
    data: data.map((row, index) => ({
      ...row,
      _id: row.id ?? `row-${index}`,
    })),
    showHeader,
    striped,
  };
}

// List data transform
export function transformListData(props: ListSchema["props"]) {
  const { items, showSeparators = true } = props;

  return {
    items: items.map((item, index) => ({
      id: item.id ?? `item-${index}`,
      title: item.title,
      subtitle: item.subtitle,
      icon: item.icon,
    })),
    showSeparators,
  };
}

// Number data transform
export function transformNumberData(props: NumberSchema["props"]) {
  const {
    value,
    label,
    prefix,
    suffix,
    trend,
    trendValue,
    decimals = 0,
  } = props;

  return {
    value,
    label,
    prefix,
    suffix,
    trend,
    trendValue,
    decimals,
  };
}

// Progress data transform
export function transformProgressData(props: ProgressSchema["props"]) {
  const {
    value,
    max = 100,
    variant = "linear",
    showLabel = true,
    label,
  } = props;

  return {
    value: Math.min(Math.max(value, 0), max),
    max,
    variant,
    showLabel,
    label: label ?? `${Math.round((value / max) * 100)}%`,
  };
}

// Timeline data transform
export function transformTimelineData(props: TimelineSchema["props"]) {
  const { phases, showConnectors = true } = props;

  return {
    phases: phases.map((phase, index) => ({
      id: phase.id ?? `phase-${index}`,
      title: phase.title,
      description: phase.description,
      status: phase.status,
      timestamp: phase.timestamp,
    })),
    showConnectors,
  };
}

// Task data transform
export function transformTaskData(props: TaskSchema["props"]) {
  return {
    id: props.id,
    title: props.title,
    description: props.description,
    status: props.status,
    dueDate: props.dueDate,
    priority: props.priority ?? "medium",
  };
}

// Plan data transform
export function transformPlanData(props: PlanSchema["props"]) {
  return {
    title: props.title,
    phases: props.phases.map((phase, index) => ({
      id: phase.id ?? `phase-${index}`,
      name: phase.name,
      tasks: phase.tasks.map((task, taskIndex) => ({
        id: task.id ?? `task-${index}-${taskIndex}`,
        title: task.title,
        completed: task.completed,
      })),
      progress: phase.progress,
    })),
    totalProgress: props.totalProgress,
  };
}

// Generic passthrough transform for components that don't need transformation
export function passthroughTransform(props: unknown): unknown {
  return props;
}

// Transform registry
export const GENUI_TRANSFORMS: Record<string, (props: unknown) => unknown> = {
  chart: transformChartData as (props: unknown) => unknown,
  grid: transformGridData as (props: unknown) => unknown,
  list: transformListData as (props: unknown) => unknown,
  number: transformNumberData as (props: unknown) => unknown,
  progress: transformProgressData as (props: unknown) => unknown,
  timeline: transformTimelineData as (props: unknown) => unknown,
  task: transformTaskData as (props: unknown) => unknown,
  plan: transformPlanData as (props: unknown) => unknown,
  // Components that use passthrough
  confirm: passthroughTransform,
  term: passthroughTransform,
  matrix: passthroughTransform,
  cite: passthroughTransform,
  branch: passthroughTransform,
  select: passthroughTransform,
};

// Get transform for a component
export function getTransform(componentName: string) {
  return GENUI_TRANSFORMS[componentName] ?? passthroughTransform;
}
