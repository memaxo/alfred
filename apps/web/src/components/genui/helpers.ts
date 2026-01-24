/**
 * GenUI Form Component Helpers
 *
 * Shared utilities for GenUI form components.
 */

import type { UIComponent } from "@alfred/type/genui";

import * as React from "react";

import { useFieldContext } from "@/form";

/**
 * Form component names that integrate with TanStack Form.
 */
export const FORM_COMPONENTS = new Set([
  "text",
  "select",
  "date",
  "daterange",
  "checkbox",
  "choice",
  "autocomplete",
  "dropdown",
]);

/**
 * Extract field name from schema props or generate from key.
 */
export function extractFieldName(schema: UIComponent): string {
  if (
    typeof schema.props === "object" &&
    schema.props !== null &&
    "name" in schema.props &&
    typeof schema.props.name === "string" &&
    schema.props.name.length > 0
  ) {
    return schema.props.name;
  }
  return schema.key ?? `field-${schema.component}`;
}

/**
 * Join array of IDs, filtering out empty strings.
 */
export function joinIds(ids: Array<string | undefined>): string | undefined {
  const filtered = ids.filter((id) => id && id.trim().length > 0);
  return filtered.length > 0 ? filtered.join(" ") : undefined;
}

/**
 * Field error display component.
 */
export function FieldErrors({ id }: { id: string }): React.ReactElement | null {
  const field = useFieldContext<unknown>();
  if (field.state.meta.errors.length === 0) {
    return null;
  }
  return React.createElement(
    "div",
    { className: "space-y-1", id },
    field.state.meta.errors.map((error: unknown) => {
      const errorMessage =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : String(error);
      return React.createElement(
        "p",
        { className: "text-destructive text-sm", key: errorMessage },
        errorMessage
      );
    })
  );
}

/**
 * Extract a string prop from schema, with optional fallback.
 */
export function extractStringProp(
  schema: UIComponent,
  propName: string,
  fallback?: string
): string | undefined {
  if (
    typeof schema.props === "object" &&
    schema.props !== null &&
    propName in schema.props &&
    typeof schema.props[propName] === "string"
  ) {
    return schema.props[propName];
  }
  return fallback;
}

/**
 * Extract a boolean prop from schema, with optional fallback.
 */
export function extractBooleanProp(
  schema: UIComponent,
  propName: string,
  fallback = false
): boolean {
  if (
    typeof schema.props === "object" &&
    schema.props !== null &&
    propName in schema.props &&
    typeof schema.props[propName] === "boolean"
  ) {
    return schema.props[propName];
  }
  return fallback;
}

/**
 * Extract an array prop from schema, with optional fallback.
 */
export function extractArrayProp<T = unknown>(
  schema: UIComponent,
  propName: string,
  fallback: T[] = []
): T[] {
  if (
    typeof schema.props === "object" &&
    schema.props !== null &&
    propName in schema.props &&
    Array.isArray(schema.props[propName])
  ) {
    return schema.props[propName] as T[];
  }
  return fallback;
}

/**
 * Extract label from schema props, falling back to field name.
 */
export function extractLabel(schema: UIComponent, fieldName: string): string {
  return extractStringProp(schema, "label") ?? fieldName;
}

/**
 * Parse option value from option object or string.
 */
export function parseOptionValue(option: unknown): string {
  if (typeof option === "string") {
    return option;
  }
  if (
    typeof option === "object" &&
    option !== null &&
    "value" in option &&
    typeof option.value === "string"
  ) {
    return option.value;
  }
  return String(option);
}

/**
 * Parse option label from option object or string.
 */
export function parseOptionLabel(
  option: unknown,
  fallbackValue: string
): string {
  if (typeof option === "string") {
    return option;
  }
  if (
    typeof option === "object" &&
    option !== null &&
    "label" in option &&
    typeof option.label === "string"
  ) {
    return option.label;
  }
  return fallbackValue;
}

/**
 * Format date value for input (YYYY-MM-DD).
 */
export function formatDateValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString().split("T")[0] ?? "";
  }
  return "";
}

/**
 * Extract default value from schema props.
 */
export function extractDefaultValue(schema: UIComponent): unknown {
  if (
    typeof schema.props === "object" &&
    schema.props !== null &&
    "defaultValue" in schema.props
  ) {
    return schema.props.defaultValue;
  }
  return;
}
