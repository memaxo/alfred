import type { ReactNode } from "react";

import {
  createFormHook,
  createFormHookContexts,
  useStore,
} from "@tanstack/react-form";
import { useCallback, useMemo, useRef } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

function joinIds(ids: (string | undefined)[]) {
  const filtered = ids.filter((id) => id && id.trim().length > 0);
  return filtered.length > 0 ? filtered.join(" ") : undefined;
}

function focusFirstInvalid(formEl: HTMLFormElement | null) {
  if (!formEl) {
    return;
  }
  const el = formEl.querySelector(
    "[aria-invalid='true']"
  ) as HTMLElement | null;
  el?.focus();
}

function FieldErrors({ id }: { id: string }) {
  const field = useFieldContext<unknown>();
  if (field.state.meta.errors.length === 0) {
    return null;
  }
  return (
    <div className="space-y-1" id={id}>
      {field.state.meta.errors.map((error) => (
        <p
          className="text-destructive text-sm"
          key={String(error?.message ?? error)}
        >
          {String(error?.message ?? error)}
        </p>
      ))}
    </div>
  );
}

export function TextField({
  label,
  type = "text",
  placeholder,
  autoFocus,
  disabled,
  className,
  inputClassName,
  inputProps,
}: {
  label: string;
  type?: React.ComponentProps<"input">["type"];
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  inputProps?: Omit<
    React.ComponentProps<"input">,
    | "aria-describedby"
    | "aria-invalid"
    | "id"
    | "name"
    | "onBlur"
    | "onChange"
    | "type"
    | "value"
  >;
}) {
  const field = useFieldContext<string>();
  const errorId = `${field.name}-error`;
  const hasErrors = field.state.meta.errors.length > 0;

  return (
    <div className={className}>
      <div className="space-y-2">
        <Label htmlFor={field.name}>{label}</Label>
        <Input
          aria-describedby={joinIds([hasErrors ? errorId : undefined])}
          aria-invalid={hasErrors}
          autoFocus={autoFocus}
          className={inputClassName}
          disabled={disabled}
          id={field.name}
          name={field.name}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          value={field.state.value}
          {...inputProps}
        />
        <FieldErrors id={errorId} />
      </div>
    </div>
  );
}

export function TextareaField({
  label,
  placeholder,
  disabled,
  className,
  rows,
  textareaProps,
}: {
  label: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  rows?: number;
  textareaProps?: Omit<
    React.ComponentProps<"textarea">,
    | "aria-describedby"
    | "aria-invalid"
    | "id"
    | "name"
    | "onBlur"
    | "onChange"
    | "rows"
    | "value"
  >;
}) {
  const field = useFieldContext<string>();
  const errorId = `${field.name}-error`;
  const hasErrors = field.state.meta.errors.length > 0;

  return (
    <div className={className}>
      <div className="space-y-2">
        <Label htmlFor={field.name}>{label}</Label>
        <Textarea
          aria-describedby={joinIds([hasErrors ? errorId : undefined])}
          aria-invalid={hasErrors}
          disabled={disabled}
          id={field.name}
          name={field.name}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          value={field.state.value}
          {...textareaProps}
        />
        <FieldErrors id={errorId} />
      </div>
    </div>
  );
}

export function SubmitButton({
  children,
  disabled,
  className,
}: {
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const form = useFormContext();
  return (
    <form.Subscribe
      selector={(state) => ({
        canSubmit: state.canSubmit,
        isSubmitting: state.isSubmitting,
      })}
    >
      {({ canSubmit, isSubmitting }) => (
        <button
          className={className}
          disabled={disabled || !canSubmit || isSubmitting}
          type="submit"
        >
          {children}
        </button>
      )}
    </form.Subscribe>
  );
}

export function FormErrors({ className }: { className?: string }) {
  const form = useFormContext();
  const errors = useStore(form.store, (state) => state.errors);
  if (errors.length === 0) {
    return null;
  }
  return (
    <div className={className}>
      {errors.map((error) => (
        <p className="text-destructive text-sm" key={String(error)}>
          {String(error)}
        </p>
      ))}
    </div>
  );
}

export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    TextareaField,
  },
  formComponents: {
    FormErrors,
    SubmitButton,
  },
});

export function useSubmitInvalidFocus() {
  const formRef = useRef<HTMLFormElement | null>(null);

  const onSubmitInvalid = useCallback(() => {
    focusFirstInvalid(formRef.current);
  }, []);

  const bind = useMemo(
    () => ({
      ref: formRef,
      onSubmitInvalid,
    }),
    [onSubmitInvalid]
  );

  return bind;
}
