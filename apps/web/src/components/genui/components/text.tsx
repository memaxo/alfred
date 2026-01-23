/**
 * GenUI Text Input Component
 *
 * Renders a text input field that integrates with TanStack Form.
 * Extracts field name and props from the UIComponent schema.
 */

import type * as React from "react";
import { useFieldContext } from "@/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UIComponent } from "@alfred/type/genui";
import {
  extractFieldName,
  extractLabel,
  extractStringProp,
  extractBooleanProp,
  FieldErrors,
  joinIds,
} from "../helpers";

export function GenUIText({ schema }: { schema: UIComponent }) {
  const fieldName = extractFieldName(schema);
  const field = useFieldContext<string>();
  
  const label = extractLabel(schema, fieldName);
  const placeholder = extractStringProp(schema, "placeholder");
  const disabled = extractBooleanProp(schema, "disabled");
  const type =
    (extractStringProp(schema, "type") as React.ComponentProps<"input">["type"]) ?? "text";

  const errorId = `${field.name}-error`;
  const hasErrors = field.state.meta.errors.length > 0;

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        aria-describedby={joinIds([hasErrors ? errorId : undefined])}
        aria-invalid={hasErrors}
        className="w-full"
        disabled={disabled}
        id={field.name}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        value={field.state.value ?? ""}
      />
      <FieldErrors id={errorId} />
    </div>
  );
}
