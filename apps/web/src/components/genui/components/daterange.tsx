/**
 * GenUI Date Range Component
 *
 * Renders date range inputs (start and end dates) that integrate with TanStack Form.
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

/**
 * GenUI Date Range Component
 *
 * Renders date range inputs (start and end dates) that integrate with TanStack Form.
 * Currently renders only the start field; end field handling is incomplete.
 */
export function GenUIDaterange({ schema }: { schema: UIComponent }) {
  const baseFieldName = extractFieldName(schema);
  const startField = useFieldContext<string>();

  const label = extractLabel(schema, baseFieldName);
  const disabled = extractBooleanProp(schema, "disabled");

  const startErrorId = `${startField.name ?? "field"}-error`;
  const hasStartErrors = startField.state.meta.errors.length > 0;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label
            className="text-muted-foreground text-xs"
            htmlFor={startField.name ?? ""}
          >
            Start
          </Label>
          <Input
            aria-describedby={joinIds([
              hasStartErrors ? startErrorId : undefined,
            ])}
            aria-invalid={hasStartErrors}
            className="w-full"
            disabled={disabled}
            id={startField.name ?? ""}
            name={startField.name ?? ""}
            onBlur={startField.handleBlur}
            onChange={(e) => startField.handleChange(e.target.value)}
            type="date"
            value={formatDateValue(startField.state.value)}
          />
          {hasStartErrors && <FieldErrors id={startErrorId} />}
        </div>
      </div>
    </div>
  );
}
