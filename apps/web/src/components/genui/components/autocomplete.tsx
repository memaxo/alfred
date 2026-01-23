/**
 * GenUI Autocomplete Component
 *
 * Renders an autocomplete input that integrates with TanStack Form.
 * For now, this is implemented as a text input with datalist for autocomplete.
 */

import type { UIComponent } from "@alfred/type/genui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFieldContext } from "@/form";
import {
  extractArrayProp,
  extractBooleanProp,
  extractFieldName,
  extractLabel,
  extractStringProp,
  FieldErrors,
  joinIds,
  parseOptionValue,
} from "../helpers";

export function GenUIAutocomplete({ schema }: { schema: UIComponent }) {
  const fieldName = extractFieldName(schema);
  const field = useFieldContext<string>();

  const label = extractLabel(schema, fieldName);
  const placeholder = extractStringProp(schema, "placeholder");
  const disabled = extractBooleanProp(schema, "disabled");
  const options = extractArrayProp(schema, "options");

  const errorId = `${field.name}-error`;
  const hasErrors = field.state.meta.errors.length > 0;
  const listId = `${field.name}-list`;

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        aria-describedby={joinIds([hasErrors ? errorId : undefined])}
        aria-invalid={hasErrors}
        className="w-full"
        disabled={disabled}
        id={field.name}
        list={listId}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        placeholder={placeholder}
        type="text"
        value={field.state.value ?? ""}
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((option) => {
            const value = parseOptionValue(option);
            return <option key={value} value={value} />;
          })}
        </datalist>
      )}
      <FieldErrors id={errorId} />
    </div>
  );
}
