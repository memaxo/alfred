import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppForm, useSubmitInvalidFocus } from "@/form";
import type { CognitiveFeedbackStatus } from "@/hooks/use-cognitive-feedback";

export type CognitiveFeedbackDraft = {
  streamId: string;
  expected: string;
  actual?: string;
  intent: "positive" | "negative";
  surface: "chat" | "mindscape" | "voice";
};

type FormValues = {
  expected: string;
  actual: string;
};

export type CognitiveFeedbackDialogProps = {
  draft: CognitiveFeedbackDraft | null;
  status: CognitiveFeedbackStatus;
  error?: Error | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    values: FormValues & { surface?: CognitiveFeedbackDraft["surface"] }
  ) => Promise<void> | void;
};

export function CognitiveFeedbackDialog({
  draft,
  status,
  error,
  onOpenChange,
  onSubmit,
}: CognitiveFeedbackDialogProps) {
  const { ref, onSubmitInvalid } = useSubmitInvalidFocus();
  const form = useAppForm({
    defaultValues: {
      expected: draft?.expected ?? "",
      actual: draft?.actual ?? "",
    },
    onSubmitInvalid,
    validators: {
      onSubmit: z.object({
        expected: z
          .string()
          .refine((value) => value.trim().length > 0, { message: "Required" }),
        actual: z.string(),
      }),
    },
    onSubmit: async ({ value }) => {
      if (!draft || status === "pending") {
        return;
      }
      await onSubmit({
        expected: value.expected.trim() || draft.expected,
        actual: value.actual.trim(),
        surface: draft.surface,
      });
    },
  });

  const open = Boolean(draft);

  const intentLabel =
    draft?.intent === "positive" ? "Positive signal" : "Needs revision";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg rounded-3xl border border-white/5 bg-void-surface/90 text-biolum shadow-lg backdrop-blur">
        <DialogHeader>
          <DialogTitle className="tracking-tight">Share Feedback</DialogTitle>
          <DialogDescription className="text-biolum-dim">
            Let Alfred know whether the response met your expectations.
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <form.AppForm>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const expectedEl =
                  event.currentTarget.elements.namedItem("expected");
                const actualEl =
                  event.currentTarget.elements.namedItem("actual");
                const expectedValue =
                  expectedEl &&
                  typeof (expectedEl as { value?: unknown }).value === "string"
                    ? (expectedEl as { value: string }).value
                    : "";
                const actualValue =
                  actualEl &&
                  typeof (actualEl as { value?: unknown }).value === "string"
                    ? (actualEl as { value: string }).value
                    : "";
                form.setFieldValue("expected", expectedValue);
                form.setFieldValue("actual", actualValue);
                void form.handleSubmit();
              }}
              ref={ref}
            >
              <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-biolum-dim text-xs uppercase tracking-[0.2em]">
                {intentLabel}
              </div>
              <form.AppField name="expected">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="expected-feedback">Expected Result</Label>
                    <Textarea
                      aria-invalid={field.state.meta.errors.length > 0}
                      id="expected-feedback"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      value={field.state.value}
                    />
                    {field.state.meta.errors.map((e) => (
                      <p className="text-destructive text-sm" key={String(e)}>
                        {String(
                          (e as { message?: string } | null)?.message ?? e
                        )}
                      </p>
                    ))}
                  </div>
                )}
              </form.AppField>
              <form.AppField name="actual">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="actual-feedback">
                      What actually happened?
                    </Label>
                    <Textarea
                      aria-invalid={field.state.meta.errors.length > 0}
                      id="actual-feedback"
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="Optional detail to help Alfred learn."
                      value={field.state.value}
                    />
                  </div>
                )}
              </form.AppField>
              {error ? (
                <p className="text-destructive text-sm">
                  {error.message ?? "Failed to submit feedback"}
                </p>
              ) : null}
              <DialogFooter className="pt-2">
                <form.Subscribe
                  selector={(state) => ({
                    isSubmitting: state.isSubmitting,
                  })}
                >
                  {({ isSubmitting }) => (
                    <div className="flex w-full gap-2">
                      <Button
                        className="flex-1"
                        disabled={status === "pending" || isSubmitting}
                        onClick={() => onOpenChange(false)}
                        type="button"
                        variant="secondary"
                      >
                        Close
                      </Button>
                      <Button
                        className="flex-1"
                        disabled={status === "pending" || isSubmitting}
                        type="submit"
                      >
                        {status === "pending" || isSubmitting
                          ? "Submitting…"
                          : "Submit Feedback"}
                      </Button>
                    </div>
                  )}
                </form.Subscribe>
              </DialogFooter>
            </form>
          </form.AppForm>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
