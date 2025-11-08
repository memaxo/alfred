import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TRPCAppRouter } from "@/utils/trpc";
import { trpc } from "@/utils/trpc";

type ProfileRow = inferRouterOutputs<TRPCAppRouter>["profile"]["get"];
type ProfileUpdateInput = inferRouterInputs<TRPCAppRouter>["profile"]["update"];

type ProfileFormState = {
  name: string;
  email: string;
  avatar: string;
  timezone: string;
};

const EMPTY_STATE: ProfileFormState = {
  name: "",
  email: "",
  avatar: "",
  timezone: "",
};

export const Route = createFileRoute("/profile")({
  component: ProfileRoute,
});

function ProfileRoute() {
  const utils = trpc.useUtils();
  const profileQuery = trpc.profile.get.useQuery();
  const [form, setForm] = useState<ProfileFormState>(EMPTY_STATE);

  const profile = profileQuery.data;
  const isLoading = profileQuery.isLoading;
  const isFetching = profileQuery.isFetching;

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? "",
        email: profile.email ?? "",
        avatar: profile.avatar ?? "",
        timezone: profile.timezone ?? "",
      });
    } else if (!isFetching) {
      setForm(EMPTY_STATE);
    }
  }, [profile, isFetching]);

  const updateForm = useCallback(
    (field: keyof ProfileFormState, value: string) => {
      setForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const handleNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateForm("name", event.target.value);
    },
    [updateForm]
  );

  const handleEmailChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateForm("email", event.target.value);
    },
    [updateForm]
  );

  const handleAvatarChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateForm("avatar", event.target.value);
    },
    [updateForm]
  );

  const handleTimezoneChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateForm("timezone", event.target.value);
    },
    [updateForm]
  );

  const normalizedProfile = useMemo(() => {
    if (!profile) {
      return EMPTY_STATE;
    }
    return {
      name: profile.name ?? "",
      email: profile.email ?? "",
      avatar: profile.avatar ?? "",
      timezone: profile.timezone ?? "",
    };
  }, [profile]);

  const hasChanges = useMemo(
    () =>
      form.name.trim() !== normalizedProfile.name ||
      form.email.trim() !== normalizedProfile.email ||
      form.avatar.trim() !== normalizedProfile.avatar ||
      form.timezone.trim() !== normalizedProfile.timezone,
    [form, normalizedProfile]
  );

  const prepareInput = useCallback((): ProfileUpdateInput => {
    const nameValue = form.name.trim();
    const emailValue = form.email.trim();
    const avatarValue = form.avatar.trim();
    const timezoneValue = form.timezone.trim();
    const payload: ProfileUpdateInput = {
      name: nameValue.length > 0 ? nameValue : null,
      email: emailValue.length > 0 ? emailValue : null,
      avatar: avatarValue.length > 0 ? avatarValue : null,
    };
    if (timezoneValue.length > 0) {
      payload.timezone = timezoneValue;
    }
    return payload;
  }, [form]);

  const updateProfile = trpc.profile.update.useMutation({
    onMutate: async (input) => {
      await utils.profile.get.cancel();
      const previous = utils.profile.get.getData();
      const nextProfile: ProfileRow =
        previous && typeof previous === "object"
          ? {
              ...previous,
              name: input.name ?? null,
              email: input.email ?? null,
              avatar: input.avatar ?? null,
              timezone: input.timezone ?? null,
            }
          : ({
              name: input.name ?? null,
              email: input.email ?? null,
              avatar: input.avatar ?? null,
              timezone: input.timezone ?? null,
            } as ProfileRow);
      utils.profile.get.setData(undefined, nextProfile);
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous !== undefined) {
        utils.profile.get.setData(undefined, context.previous as ProfileRow);
      }
      toast.error(error.message ?? "profile_update_failed");
    },
    onSuccess: (data) => {
      utils.profile.get.setData(undefined, data);
      toast.success("Profile updated");
    },
    onSettled: async () => {
      await utils.profile.get.invalidate();
    },
  });

  const isPending = updateProfile.isPending;

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!hasChanges || isPending) {
        return;
      }
      const input = prepareInput();
      updateProfile.mutate(input);
    },
    [hasChanges, isPending, prepareInput, updateProfile]
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your personal details.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              autoComplete="name"
              disabled={isPending || isLoading}
              onChange={handleNameChange}
              placeholder="Name"
              value={form.name}
            />
            <Input
              autoComplete="email"
              disabled={isPending || isLoading}
              onChange={handleEmailChange}
              placeholder="Email"
              type="email"
              value={form.email}
            />
            <Input
              disabled={isPending || isLoading}
              onChange={handleAvatarChange}
              placeholder="Avatar URL"
              type="url"
              value={form.avatar}
            />
            <Input
              disabled={isPending || isLoading}
              onChange={handleTimezoneChange}
              placeholder="Timezone (e.g. America/New_York)"
              value={form.timezone}
            />
            <Button
              disabled={!hasChanges || isPending || isLoading}
              type="submit"
            >
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
