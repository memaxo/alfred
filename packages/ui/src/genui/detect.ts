/**
 * GenUI Schema Detection Utilities
 *
 * Detects component types and patterns in UIComponent schemas.
 */

import type { UIComponent } from "@alfred/type/genui";

const FORM_COMPONENTS = new Set([
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
 * Check if a UIComponent schema contains form components.
 *
 * @param schema - The UIComponent schema to check
 * @returns True if the schema contains any form components
 */
export function containsFormComponents(schema: UIComponent): boolean {
  // Check root component
  if (FORM_COMPONENTS.has(schema.component)) {
    return true;
  }

  // Check children recursively
  if (schema.children && schema.children.length > 0) {
    for (const child of schema.children) {
      if (containsFormComponents(child)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extract form ID from schema props or generate one.
 *
 * @param schema - The UIComponent schema
 * @returns Form ID string
 */
export function extractFormId(schema: UIComponent): string {
  if (
    typeof schema.props === "object" &&
    schema.props !== null &&
    "formId" in schema.props &&
    typeof schema.props.formId === "string" &&
    schema.props.formId.length > 0
  ) {
    return schema.props.formId;
  }
  // Generate a stable ID from component structure
  return `form-${schema.component}-${schema.key ?? "default"}`;
}
