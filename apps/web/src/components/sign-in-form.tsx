import { signInSchema } from "@alfred/type/forms";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { useAppForm, useSubmitInvalidFocus } from "@/form";
import { authClient } from "@/lib/auth-client";

import Loader from "./loader";
import { Button } from "./ui/button";

export default function SignInForm({
  onSwitchToSignUp,
}: {
  onSwitchToSignUp: () => void;
}) {
  const navigate = useNavigate({
    from: "/",
  });
  const { isPending } = authClient.useSession();

  const { ref, onSubmitInvalid } = useSubmitInvalidFocus();

  const form = useAppForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmitInvalid,
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            navigate({
              to: "/",
            });
            toast.success("Sign in successful");
          },
          onError: (error: {
            error: { message?: string; statusText?: string };
          }) => {
            toast.error(error.error.message || error.error.statusText);
          },
        }
      );
    },
    validators: {
      onSubmit: signInSchema,
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="mx-auto mt-10 w-full max-w-md p-6">
      <h1 className="mb-6 text-center font-bold text-3xl">Welcome Back</h1>

      <form.AppForm>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          ref={ref}
        >
          <form.AppField name="email">
            {(field) => (
              <field.TextField
                label="Email"
                placeholder="name@example.com"
                type="email"
              />
            )}
          </form.AppField>

          <form.AppField name="password">
            {(field) => (
              <field.TextField
                label="Password"
                placeholder="••••••••"
                type="password"
              />
            )}
          </form.AppField>

          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                className="w-full"
                disabled={!canSubmit || isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Submitting..." : "Sign In"}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </form.AppForm>

      <div className="mt-4 text-center">
        <Button
          className="text-indigo-600 hover:text-indigo-800"
          onClick={onSwitchToSignUp}
          variant="link"
        >
          Need an account? Sign Up
        </Button>
      </div>
    </div>
  );
}
