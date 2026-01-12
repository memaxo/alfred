/**
 * Profile Settings Page
 *
 * Manage user profile information (name, email, avatar, timezone).
 */

import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Save, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Autocomplete, type AutocompleteItem } from "@/components/autocomplete";
import { Input } from "@/components/text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { trpc } from "@/utils/trpc";

const breadcrumbItems: BreadcrumbItem[] = [
  { label: "Settings", href: "/settings" },
  { label: "Profile" },
];

export const Route = createFileRoute("/_protected/settings/profile")({
  component: ProfileSettingsPage,
});

export function ProfileSettingsPage() {
  const utils = trpc.useUtils();
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

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    avatar: "",
    timezone: "",
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name ?? "",
        email: profile.email ?? "",
        avatar: profile.avatar ?? "",
        timezone:
          profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }
  }, [profile]);

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile updated");
      utils.profile.get.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  const handleSave = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      updateProfile.mutate({
        name: formData.name || null,
        email: formData.email || null,
        avatar: formData.avatar || null,
        timezone: formData.timezone,
      });
    },
    [formData, updateProfile]
  );

  const isDirty =
    profile &&
    (formData.name !== (profile.name ?? "") ||
      formData.email !== (profile.email ?? "") ||
      formData.avatar !== (profile.avatar ?? "") ||
      formData.timezone !== (profile.timezone ?? ""));

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-biolum" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-8 py-10">
      <Breadcrumb items={breadcrumbItems} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="font-bold text-3xl text-biolum tracking-tight">
            Profile Settings
          </h1>
          <p className="text-biolum-dim">
            Manage your personal information and how Alfred sees you.
          </p>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSave}>
        {/* Profile Avatar Section */}
        <div className="flex items-center gap-6 rounded-2xl border border-white/10 bg-void-surface/40 p-6">
          <Avatar className="h-20 w-20 border-2 border-biolum/20">
            <AvatarImage src={formData.avatar} />
            <AvatarFallback className="bg-biolum/10 text-2xl text-biolum">
              <User size={32} />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Label htmlFor="avatar-url">Avatar URL</Label>
            <Input
              id="avatar-url"
              onChange={(e) =>
                setFormData({ ...formData, avatar: e.target.value })
              }
              placeholder="https://example.com/avatar.png"
              value={formData.avatar}
            />
            <p className="text-biolum-faint text-xs">
              Direct link to an image (JPEG, PNG, or WebP).
            </p>
          </div>
        </div>

        {/* Basic Info */}
        <div className="grid gap-6 rounded-2xl border border-white/10 bg-void-surface/40 p-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Full Name</Label>
            <Input
              id="profile-name"
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Your name"
              value={formData.name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email Address</Label>
            <Input
              id="profile-email"
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="name@example.com"
              type="email"
              value={formData.email}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="profile-timezone">Timezone</Label>
            {timezoneItems.length > 0 ? (
              <Autocomplete
                items={timezoneItems}
                onValueChange={(timezone) =>
                  setFormData({ ...formData, timezone })
                }
                placeholder="Select a timezone…"
                searchPlaceholder="Search timezones…"
                value={formData.timezone}
              />
            ) : (
              <Input
                id="profile-timezone"
                onChange={(e) =>
                  setFormData({ ...formData, timezone: e.target.value })
                }
                placeholder="UTC, America/New_York, etc."
                value={formData.timezone}
              />
            )}
            <p className="text-biolum-faint text-xs">
              Used for scheduling and contextual reminders.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Button
            className="rounded-full"
            disabled={!isDirty || updateProfile.isPending}
            type="submit"
          >
            {updateProfile.isPending ? (
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
        </div>
      </form>
    </div>
  );
}
