/**
 * GenUI Checkbox Component
 *
 * Renders a checkbox that integrates with TanStack Form.
 */

import type { UIComponent } from "@alfred/type/genui";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useFieldContext } from "@/form";
import {
  extractBooleanProp,
  extractFieldName,
  extractLabel,
  FieldErrors,
  joinIds,
} from "../helpers";

export function GenUICheckbox({ schema }: { schema: UIComponent }) {
  const fieldName = extractFieldName(schema);
  const field = useFieldContext<boolean>();

  const label = extractLabel(schema, fieldName);
  const disabled = extractBooleanProp(schema, "disabled");

  const errorId = `${field.name}-error`;
  const hasErrors = field.state.meta.errors.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Checkbox
          aria-describedby={joinIds([hasErrors ? errorId : undefined])}
          aria-invalid={hasErrors}
          checked={field.state.value ?? false}
          disabled={disabled}
          id={field.name}
          onCheckedChange={(checked) => field.handleChange(checked === true)}
        />
        <Label className="cursor-pointer" htmlFor={field.name}>
          {label}
        </Label>
      </div>
      <FieldErrors id={errorId} />
    </div>
  );
}
