/**
 * GenUI Choice (Radio) Component
 *
 * Renders radio buttons that integrate with TanStack Form.
 */

import type { UIComponent } from "@alfred/type/genui";
import { Label } from "@/components/ui/label";
import { useFieldContext } from "@/form";
import {
  extractArrayProp,
  extractBooleanProp,
  extractFieldName,
  extractLabel,
  FieldErrors,
  joinIds,
  parseOptionLabel,
  parseOptionValue,
} from "../helpers";

export function GenUIChoice({ schema }: { schema: UIComponent }) {
  const fieldName = extractFieldName(schema);
  const field = useFieldContext<string>();

  const label = extractLabel(schema, fieldName);
  const disabled = extractBooleanProp(schema, "disabled");
  const options = extractArrayProp(schema, "options");

  const errorId = `${field.name}-error`;
  const hasErrors = field.state.meta.errors.length > 0;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {options.map((option) => {
          const value = parseOptionValue(option);
          const optionLabel = parseOptionLabel(option, value);
          const optionId = `${field.name}-${value}`;
          return (
            <div className="flex items-center gap-2" key={value}>
              <input
                aria-describedby={joinIds([hasErrors ? errorId : undefined])}
                aria-invalid={hasErrors}
                checked={field.state.value === value}
                className="h-4 w-4 rounded border border-input"
                disabled={disabled}
                id={optionId}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={() => field.handleChange(value)}
                type="radio"
                value={value}
              />
              <Label className="cursor-pointer" htmlFor={optionId}>
                {optionLabel}
              </Label>
            </div>
          );
        })}
      </div>
      <FieldErrors id={errorId} />
    </div>
  );
}
