/**
 * Profile Settings Section
 *
 * Manage user profile information (name, email, avatar, timezone).
 * Migrated from routes/_protected/settings/profile.tsx
 */

import { useStore } from "@tanstack/react-form";
import { Loader2, Save, User } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Autocomplete, type AutocompleteItem } from "@/components/autocomplete";
import { Input } from "@/components/text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAppForm, useSubmitInvalidFocus } from "@/form";
import { trpc } from "@/utils/trpc";

type ProfileData = {
  name: string | null;
  email: string | null;
  avatar: string | null;
  timezone: string | null;
};

const profileSchema = z.object({
  name: z.string(),
  email: z.union([z.literal(""), z.email("Invalid email address")]),
  avatar: z.string().refine(
    (value) => {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return true;
      }
      try {
        new URL(trimmed);
        return true;
      } catch {
        return false;
      }
    },
    {
      message: "Enter a valid URL",
    }
  ),
  timezone: z
    .string()
    .refine((value) => value.trim().length > 0, { message: "Required" }),
});

function ProfileForm({
  profile,
  timezoneItems,
}: {
  profile: ProfileData;
  timezoneItems: AutocompleteItem[];
}) {
  const utils = trpc.useUtils();
  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile updated");
      utils.profile.get.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  const { ref, onSubmitInvalid } = useSubmitInvalidFocus();

  const form = useAppForm({
    defaultValues: {
      name: profile.name ?? "",
      email: profile.email ?? "",
      avatar: profile.avatar ?? "",
      timezone:
        profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    onSubmitInvalid,
    validators: {
      onSubmit: profileSchema,
    },
    onSubmit: ({ value }) => {
      updateProfile.mutate({
        name: value.name.trim() || null,
        email: value.email.trim() || null,
        avatar: value.avatar.trim() || null,
        timezone: value.timezone.trim(),
      });
    },
  });

  const values = useStore(form.store, (state) => state.values);
  const isDirty =
    values.name !== (profile.name ?? "") ||
    values.email !== (profile.email ?? "") ||
    values.avatar !== (profile.avatar ?? "") ||
    values.timezone !== (profile.timezone ?? "");

  return (
    <form.AppForm>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        ref={ref}
      >
        {/* Profile Avatar Section */}
        <div className="flex items-center gap-6 rounded-xl border border-white/10 bg-white/5 p-6">
          <Avatar className="h-20 w-20 border-2 border-biolum/20">
            <AvatarImage src={values.avatar.trim() || undefined} />
            <AvatarFallback className="bg-biolum/10 text-2xl text-biolum">
              <User size={32} />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <form.AppField name="avatar">
              {(field) => (
                <>
                  <Label htmlFor={field.name}>Avatar URL</Label>
                  <Input
                    id={field.name}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="https://example.com/avatar.png"
                    value={field.state.value}
                  />
                  {field.state.meta.errors.map((error) => (
                    <p className="text-destructive text-sm" key={String(error)}>
                      {String(error?.message ?? error)}
                    </p>
                  ))}
                </>
              )}
            </form.AppField>
            <p className="text-biolum-faint text-xs">
              Direct link to an image (JPEG, PNG, or WebP).
            </p>
          </div>
        </div>

        {/* Basic Info */}
        <div className="grid gap-6 rounded-xl border border-white/10 bg-white/5 p-6 sm:grid-cols-2">
          <form.AppField name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Full Name</Label>
                <Input
                  id={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Your name"
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-destructive text-sm" key={String(error)}>
                    {String(error?.message ?? error)}
                  </p>
                ))}
              </div>
            )}
          </form.AppField>
          <form.AppField name="email">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Email Address</Label>
                <Input
                  id={field.name}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="name@example.com"
                  type="email"
                  value={field.state.value}
                />
                {field.state.meta.errors.map((error) => (
                  <p className="text-destructive text-sm" key={String(error)}>
                    {String(error?.message ?? error)}
                  </p>
                ))}
              </div>
            )}
          </form.AppField>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="profile-timezone">Timezone</Label>
            {timezoneItems.length > 0 ? (
              <form.AppField name="timezone">
                {(field) => (
                  <>
                    <Autocomplete
                      items={timezoneItems}
                      onValueChange={(timezone) => field.handleChange(timezone)}
                      placeholder="Select a timezone…"
                      searchPlaceholder="Search timezones…"
                      value={field.state.value}
                    />
                    {field.state.meta.errors.map((error) => (
                      <p
                        className="text-destructive text-sm"
                        key={String(error)}
                      >
                        {String(error?.message ?? error)}
                      </p>
                    ))}
                  </>
                )}
              </form.AppField>
            ) : (
              <form.AppField name="timezone">
                {(field) => (
                  <>
                    <Input
                      id="profile-timezone"
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="UTC, America/New_York, etc."
                      value={field.state.value}
                    />
                    {field.state.meta.errors.map((error) => (
                      <p
                        className="text-destructive text-sm"
                        key={String(error)}
                      >
                        {String(error?.message ?? error)}
                      </p>
                    ))}
                  </>
                )}
              </form.AppField>
            )}
            <p className="text-biolum-faint text-xs">
              Used for scheduling and contextual reminders.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                className="rounded-full"
                disabled={!(isDirty && canSubmit) || isSubmitting}
                type="submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </form.AppForm>
  );
}

export function ProfileSection() {
  const { data: profile, isLoading } = trpc.profile.get.useQuery();

  const timezoneItems: AutocompleteItem[] = useMemo(() => {
    const supportedValuesOf = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf;
    const tz =
      typeof supportedValuesOf === "function"
        ? supportedValuesOf("timeZone")
        : [];
    return tz.map((value) => ({ value, label: value, keywords: [value] }));
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-biolum" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="font-semibold text-lg">Profile</h2>
        <p className="mt-1 text-biolum-dim text-sm">
          Manage your personal information and how Alfred sees you.
        </p>
      </div>

      {profile ? (
        <ProfileForm
          key={`${profile.name ?? ""}:${profile.email ?? ""}:${profile.avatar ?? ""}:${profile.timezone ?? ""}`}
          profile={profile as ProfileData}
          timezoneItems={timezoneItems}
        />
      ) : null}
    </div>
  );
}
