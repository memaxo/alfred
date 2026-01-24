/**
 * GenUI Date Input Component
 *
 * Renders a date input that integrates with TanStack Form.
 */

import type { UIComponent } from "@alfred/type/genui";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFieldContext } from "@/form";

import {
  extractBooleanProp,
  extractFieldName,
  extractLabel,
  FieldErrors,
  formatDateValue,
  joinIds,
} from "../helpers";

export function GenUIDate({ schema }: { schema: UIComponent }) {
  const fieldName = extractFieldName(schema);
  const field = useFieldContext<string>();

  const label = extractLabel(schema, fieldName);
  const disabled = extractBooleanProp(schema, "disabled");

  const errorId = `${field.name}-error`;
  const hasErrors = field.state.meta.errors.length > 0;
  const dateValue = formatDateValue(field.state.value);

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
        type="date"
        value={dateValue}
      />
      <FieldErrors id={errorId} />
    </div>
  );
}
