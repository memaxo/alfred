import { useEffect, useState } from "react";
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
  onSubmit: (values: FormValues) => Promise<void> | void;
};

export function CognitiveFeedbackDialog({
  draft,
  status,
  error,
  onOpenChange,
  onSubmit,
}: CognitiveFeedbackDialogProps) {
  const [expected, setExpected] = useState(draft?.expected ?? "");
  const [actual, setActual] = useState(draft?.actual ?? "");

  useEffect(() => {
    if (draft) {
      setExpected(draft.expected);
      setActual(draft.actual ?? "");
    }
  }, [draft]);

  const open = Boolean(draft);

  const handleSubmit = async () => {
    if (!draft || status === "pending") {
      return;
    }
    await onSubmit({
      expected: expected.trim() || draft.expected,
      actual: actual.trim(),
    });
  };

  const intentLabel =
    draft?.intent === "positive" ? "Positive signal" : "Needs revision";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg rounded-3xl border border-white/5 bg-void-surface/90 text-biolum shadow-lg backdrop-blur">
        <DialogHeader>
          <DialogTitle className="tracking-tight">
            Share Feedback
          </DialogTitle>
          <DialogDescription className="text-biolum-dim">
            Let Alfred know whether the response met your expectations.
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-xs uppercase tracking-[0.2em] text-biolum-dim">
              {intentLabel}
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected-feedback">Expected Result</Label>
              <Textarea
                id="expected-feedback"
                onChange={(event) => setExpected(event.target.value)}
                value={expected}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actual-feedback">What actually happened?</Label>
              <Textarea
                id="actual-feedback"
                onChange={(event) => setActual(event.target.value)}
                placeholder="Optional detail to help Alfred learn."
                value={actual}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">
                {error.message ?? "Failed to submit feedback"}
              </p>
            ) : null}
            <DialogFooter className="pt-2">
              <Button
                className="w-full"
                disabled={status === "pending"}
                type="submit"
              >
                {status === "pending" ? "Submitting…" : "Submit Feedback"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
