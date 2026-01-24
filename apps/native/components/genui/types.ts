/**
 * GenUI Schema Types
 *
 * These types define the schema structure for GenUI components
 * coming from the API. They map to the component registry.
 */

export interface GenUIBaseSchema {
  component: string;
  props?: Record<string, unknown>;
  children?: GenUIBaseSchema[];
  key?: string;
}

// Chart component schema
export interface ChartSchema extends GenUIBaseSchema {
  component: "chart";
  props: {
    type?: "line" | "bar" | "area";
    data: Array<{ x: number | string; y: number; label?: string }>;
    xLabel?: string;
    yLabel?: string;
    title?: string;
  };
}

// Grid component schema
export interface GridSchema extends GenUIBaseSchema {
  component: "grid";
  props: {
    columns: Array<{
      key: string;
      header: string;
      width?: number;
    }>;
    data: Array<Record<string, unknown>>;
    showHeader?: boolean;
    striped?: boolean;
  };
}

// List component schema
export interface ListSchema extends GenUIBaseSchema {
  component: "list";
  props: {
    items: Array<{
      id: string;
      title: string;
      subtitle?: string;
      icon?: string;
      onPress?: () => void;
    }>;
    showSeparators?: boolean;
  };
}

// Number component schema
export interface NumberSchema extends GenUIBaseSchema {
  component: "number";
  props: {
    value: number;
    label?: string;
    prefix?: string;
    suffix?: string;
    trend?: "up" | "down" | "neutral";
    trendValue?: string;
    decimals?: number;
  };
}

// Progress component schema
export interface ProgressSchema extends GenUIBaseSchema {
  component: "progress";
  props: {
    value: number; // 0-100
    max?: number;
    variant?: "radial" | "linear";
    showLabel?: boolean;
    label?: string;
  };
}

// Timeline component schema
export interface TimelineSchema extends GenUIBaseSchema {
  component: "timeline";
  props: {
    phases: Array<{
      id: string;
      title: string;
      description?: string;
      status: "pending" | "active" | "completed" | "error";
      timestamp?: string;
    }>;
    showConnectors?: boolean;
  };
}

// Confirm component schema
export interface ConfirmSchema extends GenUIBaseSchema {
  component: "confirm";
  props: {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "default" | "destructive";
  };
}

// Task component schema
export interface TaskSchema extends GenUIBaseSchema {
  component: "task";
  props: {
    id: string;
    title: string;
    description?: string;
    status: "pending" | "in_progress" | "completed" | "cancelled";
    dueDate?: string;
    priority?: "low" | "medium" | "high";
  };
}

// Plan component schema
export interface PlanSchema extends GenUIBaseSchema {
  component: "plan";
  props: {
    title: string;
    phases: Array<{
      id: string;
      name: string;
      tasks: Array<{
        id: string;
        title: string;
        completed: boolean;
      }>;
      progress: number;
    }>;
    totalProgress: number;
  };
}

// Term component schema
export interface TermSchema extends GenUIBaseSchema {
  component: "term";
  props: {
    content: string;
    language?: string;
    showCopy?: boolean;
  };
}

// Matrix component schema
export interface MatrixSchema extends GenUIBaseSchema {
  component: "matrix";
  props: {
    rows: number;
    cols: number;
    data: Array<Array<string | number>>;
    rowHeaders?: string[];
    colHeaders?: string[];
  };
}

// Cite component schema
export interface CiteSchema extends GenUIBaseSchema {
  component: "cite";
  props: {
    title: string;
    url: string;
    snippet?: string;
    favicon?: string;
  };
}

// Branch component schema
export interface BranchSchema extends GenUIBaseSchema {
  component: "branch";
  props: {
    branches: Array<{
      id: string;
      label: string;
      preview?: string;
      timestamp?: string;
    }>;
    currentBranchId?: string;
  };
}

// Select component schema
export interface SelectSchema extends GenUIBaseSchema {
  component: "select";
  props: {
    label: string;
    options: Array<{
      value: string;
      label: string;
    }>;
    value?: string;
    placeholder?: string;
  };
}

// Union of all GenUI schemas
export type GenUISchema =
  | ChartSchema
  | GridSchema
  | ListSchema
  | NumberSchema
  | ProgressSchema
  | TimelineSchema
  | ConfirmSchema
  | TaskSchema
  | PlanSchema
  | TermSchema
  | MatrixSchema
  | CiteSchema
  | BranchSchema
  | SelectSchema
  | GenUIBaseSchema;

// Type guard for checking schema type
export function isGenUISchema(obj: unknown): obj is GenUISchema {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "component" in obj &&
    typeof (obj as GenUISchema).component === "string"
  );
}
