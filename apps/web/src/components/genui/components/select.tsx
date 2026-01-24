/**
 * GenUI Select Component
 *
 * Renders a select dropdown that integrates with TanStack Form.
 */

import type { UIComponent } from "@alfred/type/genui";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function GenUISelect({ schema }: { schema: UIComponent }) {
  const fieldName = extractFieldName(schema);
  const field = useFieldContext<string>();

  const label = extractLabel(schema, fieldName);
  const disabled = extractBooleanProp(schema, "disabled");
  const options = extractArrayProp(schema, "options");

  const errorId = `${field.name}-error`;
  const hasErrors = field.state.meta.errors.length > 0;

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Select
        disabled={disabled}
        onValueChange={(value) => field.handleChange(value)}
        value={field.state.value ?? ""}
      >
        <SelectTrigger
          aria-describedby={joinIds([hasErrors ? errorId : undefined])}
          aria-invalid={hasErrors}
          className="w-full"
          id={field.name}
        >
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => {
            const value = parseOptionValue(option);
            const optionLabel = parseOptionLabel(option, value);
            return (
              <SelectItem key={value} value={value}>
                {optionLabel}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <FieldErrors id={errorId} />
    </div>
  );
}
