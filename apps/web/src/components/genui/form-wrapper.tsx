/**
 * GenUI Form Wrapper
 *
 * Wraps GenUI form schemas with TanStack Form integration
 * and form submission functionality.
 */

import type { UIComponent } from "@alfred/type/genui";
import { UISchemaRenderer } from "@alfred/ui/genui/interpreter";
import type { ReactNode } from "react";
import { useMemo } from "react";
import type { z } from "zod";
import { useAppForm } from "@/form";
import { useSubmit } from "@/hooks/submit";
import { GenUIAutocomplete } from "./components/autocomplete";
import { GenUICheckbox } from "./components/checkbox";
import { GenUIChoice } from "./components/choice";
import { GenUIDate } from "./components/date";
import { GenUIDaterange } from "./components/daterange";
import { GenUIDropdown } from "./components/dropdown";
import { GenUISelect } from "./components/select";
import { GenUIText } from "./components/text";
import {
  extractDefaultValue,
  extractFieldName,
  FORM_COMPONENTS,
} from "./helpers";
import { uiComponentToZodSchema } from "./schema-converter";

function newId(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Extract default values from schema props and map to field names.
 */
function mapSchemaToFormFields(schema: UIComponent): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  function walk(s: UIComponent): void {
    if (FORM_COMPONENTS.has(s.component)) {
      const fieldName = extractFieldName(s);
      const defaultValue = extractDefaultValue(s);

      if (defaultValue !== undefined) {
        // Handle nested fields (e.g., daterange creates start/end)
        if (
          s.component === "daterange" &&
          typeof defaultValue === "object" &&
          defaultValue !== null
        ) {
          const range = defaultValue as { start?: unknown; end?: unknown };
          if (range.start !== undefined) {
            defaults[`${fieldName}.start`] = range.start;
          }
          if (range.end !== undefined) {
            defaults[`${fieldName}.end`] = range.end;
          }
        } else {
          defaults[fieldName] = defaultValue;
        }
      }
    }
    if (s.children && s.children.length > 0) {
      for (const child of s.children) {
        walk(child);
      }
    }
  }

  walk(schema);
  return defaults;
}

type FormWrapperProps = {
  schema: UIComponent;
  formId: string;
  conversationId: string;
  toolCallId?: string;
  formData?: unknown;
};

/**
 * Wrapper component that integrates GenUI form schemas with TanStack Form.
 *
 * Extracts form fields from the schema, creates a TanStack Form instance,
 * and handles submission via the GenUI submit hook.
 */
export function GenUIFormWrapper({
  schema,
  formId,
  conversationId,
  toolCallId,
  formData,
}: FormWrapperProps) {
  // Generate formId if not provided
  const resolvedFormId = formId || `form-${newId()}`;
  const { submit, isLoading, error } = useSubmit(conversationId);

  // Convert UIComponent schema to Zod schema for validation
  const formSchema = useMemo(() => {
    // First, try to use schema from formData if provided
    if (formData && typeof formData === "object" && "schema" in formData) {
      const schemaData = formData as { schema?: unknown };
      const candidate = schemaData.schema;
      if (candidate && typeof candidate === "object" && "_def" in candidate) {
        return candidate as z.ZodTypeAny;
      }
    }
    // Convert UIComponent schema to Zod schema
    return uiComponentToZodSchema(schema);
  }, [formData, schema]);

  const defaultValues = useMemo(() => {
    // First, extract defaults from formData if available
    const formDataDefaults =
      formData && typeof formData === "object" && "defaultValues" in formData
        ? (formData.defaultValues as Record<string, unknown>)
        : {};

    // Then, extract defaults from schema structure
    const schemaDefaults = mapSchemaToFormFields(schema);

    // Merge: formData defaults take precedence
    return { ...schemaDefaults, ...formDataDefaults };
  }, [formData, schema]);

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: ({ value }) => {
        const result = formSchema.safeParse(value);
        if (!result.success) {
          return result.error.message;
        }
        return;
      },
    },
    onSubmit: async ({ value }) => {
      await submit(resolvedFormId, value, toolCallId, schema);
    },
  });

  // Enhance schema props with form context
  const enhancedSchema = useMemo(
    () => ({
      ...schema,
      props: {
        ...schema.props,
        formId: resolvedFormId,
        conversationId,
        toolCallId,
      },
    }),
    [schema, resolvedFormId, conversationId, toolCallId]
  );

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive text-sm">
        Form submission error: {error.message}
      </div>
    );
  }

  return (
    <form.AppForm>
      <FormSchemaRenderer
        form={form as ReturnType<typeof useAppForm>}
        schema={enhancedSchema}
      />
      {isLoading && (
        <div className="mt-2 text-muted-foreground text-sm">Submitting...</div>
      )}
      <form.Subscribe
        selector={(state) => ({
          canSubmit: state.canSubmit,
          isSubmitting: state.isSubmitting,
        })}
      >
        {({ canSubmit, isSubmitting }) => (
          <button
            className="mt-4 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm disabled:opacity-50"
            disabled={!canSubmit || isSubmitting || isLoading}
            type="submit"
          >
            {isSubmitting || isLoading ? "Submitting..." : "Submit"}
          </button>
        )}
      </form.Subscribe>
    </form.AppForm>
  );
}

// Component map for form components
const FORM_COMPONENT_MAP: Record<
  string,
  React.ComponentType<{ schema: UIComponent }>
> = {
  text: GenUIText,
  select: GenUISelect,
  date: GenUIDate,
  checkbox: GenUICheckbox,
  choice: GenUIChoice,
  autocomplete: GenUIAutocomplete,
  dropdown: GenUIDropdown,
  daterange: GenUIDaterange,
};

// Custom renderer that wraps form components in form.Field
function FormSchemaRenderer({
  schema,
  form,
}: {
  schema: UIComponent;
  form: ReturnType<typeof useAppForm>;
}) {
  function renderWithFields(s: UIComponent): ReactNode {
    // If this is a form component, wrap it in form.Field
    if (FORM_COMPONENTS.has(s.component)) {
      const fieldName = extractFieldName(s);
      const defaultValue = extractDefaultValue(s);

      const Component = FORM_COMPONENT_MAP[s.component];
      if (!Component) {
        return <div key={s.key}>Unknown form component: {s.component}</div>;
      }

      return (
        <form.AppField
          defaultValue={
            typeof defaultValue === "string"
              ? defaultValue
              : typeof defaultValue === "boolean"
                ? defaultValue
                : typeof defaultValue === "object" && defaultValue !== null
                  ? defaultValue
                  : ""
          }
          key={s.key ?? fieldName}
          name={fieldName}
        >
          {() => <Component schema={s} />}
        </form.AppField>
      );
    }

    // For non-form components, use regular renderer but process children recursively
    // We need to transform children to wrap form components
    if (s.children && s.children.length > 0) {
      const processedChildren = s.children.map((child) =>
        renderWithFields(child)
      );
      // Create a wrapper that renders children
      return <div key={s.key}>{processedChildren}</div>;
    }

    // Leaf node without form components - render normally
    return <UISchemaRenderer key={s.key} schema={s} />;
  }

  return <>{renderWithFields(schema)}</>;
}
