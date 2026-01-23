/**
 * UIComponent to Zod Schema Converter
 *
 * Converts UIComponent schemas to Zod validation schemas
 * by extracting validation rules from component props.
 */

import type { UIComponent } from "@alfred/type/genui";
import { z } from "zod";
import { extractFieldName, FORM_COMPONENTS } from "./helpers";

/**
 * Convert a single UIComponent to a Zod schema for that field.
 */
function componentToZodField(schema: UIComponent): z.ZodTypeAny {
  const props =
    typeof schema.props === "object" && schema.props !== null
      ? schema.props
      : {};

  const required =
    "required" in props && typeof props.required === "boolean"
      ? props.required
      : false;

  const componentType = schema.component;

  let baseSchema: z.ZodTypeAny;

  switch (componentType) {
    case "text":
    case "autocomplete":
    case "dropdown": {
      const type =
        "type" in props && typeof props.type === "string" ? props.type : "text";

      let stringSchema = z.string();

      // Email validation
      if (type === "email") {
        stringSchema = stringSchema.email("Invalid email address");
      }

      // URL validation
      if (type === "url") {
        stringSchema = stringSchema.url("Invalid URL");
      }

      // Min length
      if ("min" in props && typeof props.min === "number") {
        stringSchema = stringSchema.min(
          props.min,
          `Must be at least ${props.min} characters`
        );
      }

      // Max length
      if ("max" in props && typeof props.max === "number") {
        stringSchema = stringSchema.max(
          props.max,
          `Must be at most ${props.max} characters`
        );
      }

      // Pattern (regex)
      if ("pattern" in props && typeof props.pattern === "string") {
        try {
          const regex = new RegExp(props.pattern);
          stringSchema = stringSchema.regex(regex, "Invalid format");
        } catch {
          // Invalid regex, ignore
        }
      }

      baseSchema = stringSchema;
      break;
    }

    case "select":
    case "choice": {
      baseSchema = z.string();

      // Validate against options if provided
      if ("options" in props && Array.isArray(props.options)) {
        const validValues: string[] = [];
        for (const option of props.options) {
          const value =
            typeof option === "string"
              ? option
              : typeof option === "object" &&
                  option !== null &&
                  "value" in option &&
                  typeof option.value === "string"
                ? option.value
                : String(option);
          validValues.push(value);
        }
        if (validValues.length > 0) {
          baseSchema = z.enum(validValues as [string, ...string[]]);
        }
      }

      break;
    }

    case "date": {
      baseSchema = z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format");
      break;
    }

    case "daterange": {
      // Daterange creates nested fields: { start: string, end: string }
      baseSchema = z.object({
        start: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date format"),
        end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date format"),
      });
      break;
    }

    case "checkbox": {
      baseSchema = z.boolean();
      break;
    }

    default: {
      // Unknown component type, default to unknown
      baseSchema = z.unknown();
      break;
    }
  }

  // Apply required/optional
  if (required) {
    return baseSchema;
  }
  return baseSchema.optional();
}

/**
 * Convert a UIComponent schema tree to a Zod schema for form validation.
 *
 * @param schema - The root UIComponent schema
 * @returns Zod schema that can be used for form validation
 */
export function uiComponentToZodSchema(schema: UIComponent): z.ZodTypeAny {
  // If this is a form component, create a field schema
  if (FORM_COMPONENTS.has(schema.component)) {
    return componentToZodField(schema);
  }

  // If this has children, create an object schema with nested fields
  if (schema.children && schema.children.length > 0) {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const child of schema.children) {
      if (FORM_COMPONENTS.has(child.component)) {
        const fieldName = extractFieldName(child);

        // Handle nested fields (e.g., daterange creates start/end)
        if (child.component === "daterange") {
          const daterangeSchema = componentToZodField(child);
          // daterangeSchema is already an object with start/end
          shape[fieldName] = daterangeSchema;
        } else {
          shape[fieldName] = componentToZodField(child);
        }
      } else if (child.children && child.children.length > 0) {
        // Recursively handle nested structures
        const nestedSchema = uiComponentToZodSchema(child);
        if (nestedSchema instanceof z.ZodObject) {
          const nestedShape = nestedSchema.shape;
          for (const [key, value] of Object.entries(nestedShape)) {
            shape[key] = value;
          }
        }
      }
    }

    if (Object.keys(shape).length > 0) {
      return z.object(shape);
    }
  }

  // Default: accept any object
  return z.record(z.string(), z.unknown());
}
