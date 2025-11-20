import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { Fingerprint, Trash2 } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RouteError } from "@/components/route-error";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
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

export const Route = createFileRoute("/_authed/profile")({
  component: ProfileRoute,
  errorComponent: RouteError,
});

function ProfileRoute() {
  const utils = trpc.useUtils();
  const profileQuery = trpc.profile.get.useQuery();
  const [form, setForm] = useState<ProfileFormState>(EMPTY_STATE);
  const [passkeys, setPasskeys] = useState<
    Array<{ id: string; name: string; deviceType?: string; createdAt?: Date }>
  >([]);
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(false);
  const [isAddingPasskey, setIsAddingPasskey] = useState(false);

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

  // Load passkeys
  useEffect(() => {
    const loadPasskeys = async () => {
      setIsLoadingPasskeys(true);
      try {
        const result = await authClient.passkey.listUserPasskeys();
        if (result.data) {
          setPasskeys(result.data);
        }
      } catch (error) {
        // Silently fail - user might not have passkeys yet
      } finally {
        setIsLoadingPasskeys(false);
      }
    };

    if (profile) {
      void loadPasskeys();
    }
  }, [profile]);

  const handleAddPasskey = useCallback(async () => {
    setIsAddingPasskey(true);
    try {
      const result = await authClient.passkey.addPasskey({
        name: `Device ${new Date().toLocaleDateString()}`,
      });
      if (result.data) {
        toast.success("Passkey added successfully");
        // Reload passkeys
        const listResult = await authClient.passkey.listUserPasskeys();
        if (listResult.data) {
          setPasskeys(listResult.data);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add passkey";
      toast.error(message);
    } finally {
      setIsAddingPasskey(false);
    }
  }, []);

  const handleDeletePasskey = useCallback(async (id: string) => {
    try {
      const result = await authClient.passkey.deletePasskey({ id });
      if (result.data) {
        toast.success("Passkey deleted");
        // Reload passkeys
        const listResult = await authClient.passkey.listUserPasskeys();
        if (listResult.data) {
          setPasskeys(listResult.data);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete passkey";
      toast.error(message);
    }
  }, []);

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

      <Card>
        <CardHeader>
          <CardTitle>Security & Passkeys</CardTitle>
          <CardDescription>
            Manage your passkeys for biometric authentication.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingPasskeys ? (
            <p className="text-muted-foreground text-sm">Loading passkeys…</p>
          ) : passkeys.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No passkeys registered. Add one to enable biometric authentication.
            </p>
          ) : (
            <ul className="space-y-3">
              {passkeys.map((passkey) => (
                <li
                  className="flex items-center justify-between rounded-md border p-3"
                  key={passkey.id}
                >
                  <div className="flex items-center gap-3">
                    <Fingerprint className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{passkey.name}</p>
                      {passkey.deviceType && (
                        <p className="text-muted-foreground text-xs">
                          {passkey.deviceType}
                        </p>
                      )}
                      {passkey.createdAt && (
                        <p className="text-muted-foreground text-xs">
                          Added{" "}
                          {typeof window !== "undefined"
                            ? new Date(passkey.createdAt).toLocaleDateString()
                            : passkey.createdAt.toString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleDeletePasskey(passkey.id)}
                    size="sm"
                    variant="outline"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button
            onClick={handleAddPasskey}
            disabled={isAddingPasskey}
            variant="outline"
            className="w-full"
          >
            <Fingerprint className="mr-2 h-4 w-4" />
            {isAddingPasskey ? "Adding passkey…" : "Add Passkey"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
