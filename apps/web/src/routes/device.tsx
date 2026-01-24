import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { useAppForm, useSubmitInvalidFocus } from "@/form";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/device")({
  component: DeviceVerification,
});

function DeviceVerification() {
  const [status, setStatus] = useState<
    "idle" | "verifying" | "success" | "error"
  >("idle");

  const { ref, onSubmitInvalid } = useSubmitInvalidFocus();
  const schema = z.object({
    userCode: z.string().refine((value) => value.replace("-", "").length >= 8, {
      message: "Enter the full code",
    }),
  });

  const form = useAppForm({
    defaultValues: {
      userCode: "",
    },
    onSubmitInvalid,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      setStatus("verifying");
      try {
        // @ts-expect-error - plugin method might not be in types yet
        const { error } = await authClient.oauth2.verifyDeviceCode({
          userCode: value.userCode.replace("-", ""),
        });
        if (error) {
          throw error;
        }
        setStatus("success");
      } catch (_err) {
        setStatus("error");
      }
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-void text-biolum">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-void-surface/40 p-8 backdrop-blur-xl">
        <h1 className="font-bold text-2xl tracking-tighter">
          ALFRED Device Login
        </h1>
        {status === "success" ? (
          <div className="space-y-4">
            <p className="text-green-400">
              ✓ Device authorized! You can close this window.
            </p>
          </div>
        ) : (
          <form.AppForm>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void form.handleSubmit();
              }}
              ref={ref}
            >
              <p className="text-biolum-dim">
                Enter the code displayed in your terminal:
              </p>
              <form.AppField name="userCode">
                {(field) => (
                  <>
                    <input
                      aria-invalid={field.state.meta.errors.length > 0}
                      className="w-full rounded-full border border-white/10 bg-void p-3 text-center text-2xl tracking-widest focus:border-biolum focus:outline-none"
                      maxLength={9}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        let val = e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, "");
                        if (val.length > 4) {
                          val = `${val.slice(0, 4)}-${val.slice(4, 8)}`;
                        }
                        field.handleChange(val);
                      }}
                      placeholder="XXXX-XXXX"
                      type="text"
                      value={field.state.value}
                    />
                    {field.state.meta.errors.length > 0 ? (
                      <p className="text-center text-red-400 text-sm">
                        {String(
                          field.state.meta.errors[0]?.message ??
                            field.state.meta.errors[0]
                        )}
                      </p>
                    ) : null}
                  </>
                )}
              </form.AppField>
              {status === "error" && (
                <p className="text-center text-red-400 text-sm">
                  Invalid or expired code. Please try again.
                </p>
              )}
              <form.Subscribe
                selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
                })}
              >
                {({ canSubmit, isSubmitting }) => (
                  <button
                    className="w-full rounded-full bg-biolum p-3 font-bold text-void transition-opacity hover:bg-biolum/90 disabled:opacity-50"
                    disabled={
                      status === "verifying" || isSubmitting || !canSubmit
                    }
                    type="submit"
                  >
                    {status === "verifying" || isSubmitting
                      ? "Verifying..."
                      : "Authorize Device"}
                  </button>
                )}
              </form.Subscribe>
            </form>
          </form.AppForm>
        )}
      </div>
    </div>
  );
}
