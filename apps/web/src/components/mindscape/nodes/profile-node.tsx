import { useForm } from "@tanstack/react-form";
import type { inferRouterOutputs } from "@trpc/server";
import type { NodeProps } from "@xyflow/react";
import { Fingerprint, UserCircle2, Volume2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VoiceSelector } from "@/components/voice-selector";
import { authClient } from "@/lib/auth-client";
import { useMindscapeStore } from "@/store/mindscape";
import { profileNodeDataSchema } from "@/store/mindscape.schemas";
import { type TRPCAppRouter, trpc } from "@/utils/trpc";
import { useLOD, useNodeFocus } from "../lod";
import { MindscapeNode } from "./mindscape-node";
import { NodeLODSmall, NodeLODTiny } from "./shared-lod";

type ProfileRow = inferRouterOutputs<TRPCAppRouter>["profile"]["get"];
// type ProfileUpdateInput = inferRouterInputs<TRPCAppRouter>["profile"]["update"];

type PasskeyInfo = {
  id: string;
  name: string;
  deviceType?: string;
  createdAt?: Date;
};

export function ProfileNode({ id, data, selected }: NodeProps) {
  const lod = useLOD();
  useNodeFocus(id);

  // Validate data structure (result intentionally unused)
  profileNodeDataSchema.safeParse(data);
  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );

  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  // ... rest of existing logic ...
  const [isAddingPasskey, setIsAddingPasskey] = useState(false);
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(false);

  const utils = trpc.useUtils();
  const profileQuery = trpc.profile.get.useQuery();
  const profile = profileQuery.data;
  const isLoadingProfile = profileQuery.isLoading;

  // Preference query for voice settings
  const preferenceQuery = trpc.preference.list.useQuery({
    limit: 100,
    offset: 0,
  });
  const preferences = preferenceQuery.data ?? [];

  const currentVoice = (() => {
    const pref = preferences.find((p) => p.key === "voice.tts");
    if (!pref?.value) {
      return;
    }
    if (typeof pref.value === "string") {
      try {
        if (pref.value.startsWith('"') && pref.value.endsWith('"')) {
          return JSON.parse(pref.value);
        }
      } catch {
        // ignore JSON parse error
      }
      return pref.value;
    }
    return;
  })();

  const currentLanguage = (() => {
    const pref = preferences.find((p) => p.key === "voice.stt.language");
    if (!pref?.value) {
      return;
    }
    if (typeof pref.value === "string") {
      try {
        if (pref.value.startsWith('"') && pref.value.endsWith('"')) {
          return JSON.parse(pref.value);
        }
      } catch {
        // ignore JSON parse error
      }
      return pref.value;
    }
    return;
  })();

  const setPreference = trpc.preference.set.useMutation({
    onSuccess: async () => {
      toast.success("Preference saved");
      await utils.preference.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message ?? "preference_update_failed");
    },
  });

  const handleVoiceChange = (voice: string) => {
    setPreference.mutate({
      key: "voice.tts",
      value: voice,
      confidence: 1,
      source: "user",
    });
  };

  const handleLanguageChange = (lang: string) => {
    setPreference.mutate({
      key: "voice.stt.language",
      value: lang,
      confidence: 1,
      source: "user",
    });
  };

  const updateProfile = trpc.profile.update.useMutation({
    onMutate: async (input) => {
      await utils.profile.get.cancel();
      const previous = utils.profile.get.getData();
      const nextProfile: ProfileRow = {
        ...(previous ?? {}),
        name: input.name ?? null,
        email: input.email ?? null,
        avatar: input.avatar ?? null,
        timezone: input.timezone ?? null,
      } as ProfileRow;
      utils.profile.get.setData(undefined, nextProfile);
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous !== undefined) {
        utils.profile.get.setData(undefined, context.previous as ProfileRow);
      }
      toast.error(error.message ?? "profile_update_failed");
    },
    onSuccess: () => {
      toast.success("Profile updated");
      updateArtifactData(id, { lastUpdatedAt: new Date().toISOString() });
    },
    onSettled: async () => {
      await utils.profile.get.invalidate();
    },
  });

  const form = useForm({
    defaultValues: {
      name: profile?.name ?? "",
      email: profile?.email ?? "",
      avatar: profile?.avatar ?? "",
      timezone: profile?.timezone ?? "",
    },
    onSubmit: async ({ value }) => {
      await updateProfile.mutateAsync({
        name: value.name.trim() || null,
        email: value.email.trim() || null,
        avatar: value.avatar.trim() || null,
        timezone: value.timezone.trim() || null,
      });
    },
  });

  // Sync form with profile data when it loads
  useEffect(() => {
    if (profile && !form.state.isDirty) {
      form.reset({
        name: profile.name ?? "",
        email: profile.email ?? "",
        avatar: profile.avatar ?? "",
        timezone: profile.timezone ?? "",
      });
      updateArtifactData(id, { lastUpdatedAt: new Date().toISOString() });
    }
  }, [profile, form, id, updateArtifactData]);

  useEffect(() => {
    const loadPasskeys = async () => {
      setIsLoadingPasskeys(true);
      try {
        const result = await authClient.passkey.listUserPasskeys();
        if (result.data) {
          setPasskeys(result.data);
        }
      } catch {
        // ignore
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

  const handleDeletePasskey = useCallback(async (passkeyId: string) => {
    try {
      const result = await authClient.passkey.deletePasskey({ id: passkeyId });
      if (result.data) {
        toast.success("Passkey deleted");
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

  // LOD 0: Tiny
  if (lod === "tiny") {
    return <NodeLODTiny color="bg-indigo-500" shadow="shadow-indigo-500/50" />;
  }

  // LOD 1: Small
  if (lod === "small") {
    return (
      <NodeLODSmall
        borderColor="border-indigo-500/30"
        hoverColor="hover:border-indigo-500/50"
        icon={<UserCircle2 className="h-3 w-3" />}
        label="Profile"
        textColor="text-indigo-300"
      />
    );
  }

  return (
    <MindscapeNode
      className="w-[420px] border-indigo-500/20 bg-indigo-950/10"
      headerActions={<UserCircle2 className="h-4 w-4 text-indigo-200" />}
      id={id}
      selected={selected}
      title="Profile"
    >
      <div className="flex flex-col gap-4 p-4">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <form.Field name="name">
            {(field) => (
              <Input
                autoComplete="name"
                disabled={isLoadingProfile || updateProfile.isPending}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Name"
                value={field.state.value}
              />
            )}
          </form.Field>
          <form.Field name="email">
            {(field) => (
              <Input
                autoComplete="email"
                disabled={isLoadingProfile || updateProfile.isPending}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Email"
                type="email"
                value={field.state.value}
              />
            )}
          </form.Field>
          <form.Field name="avatar">
            {(field) => (
              <Input
                disabled={isLoadingProfile || updateProfile.isPending}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Avatar URL"
                type="url"
                value={field.state.value}
              />
            )}
          </form.Field>
          <form.Field name="timezone">
            {(field) => (
              <Input
                disabled={isLoadingProfile || updateProfile.isPending}
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Timezone (e.g. America/New_York)"
                value={field.state.value}
              />
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                className="w-full"
                disabled={!canSubmit || isLoadingProfile}
                type="submit"
              >
                {isSubmitting || updateProfile.isPending
                  ? "Saving…"
                  : "Save changes"}
              </Button>
            )}
          </form.Subscribe>
        </form>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium text-biolum text-sm">Voice</p>
            <Volume2 className="h-4 w-4 text-indigo-200" />
          </div>
          <VoiceSelector
            onValueChange={handleVoiceChange}
            value={currentVoice as string | undefined}
          />
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium text-biolum text-sm">Language</p>
          </div>
          <Input
            onChange={(e) => handleLanguageChange(e.target.value)}
            placeholder="e.g. en, es, fr (Auto if empty)"
            value={(currentLanguage as string) ?? ""}
          />
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium text-biolum text-sm">Passkeys</p>
            <Button
              disabled={isAddingPasskey}
              onClick={handleAddPasskey}
              size="sm"
              variant="outline"
            >
              <Fingerprint className="mr-2 h-4 w-4" />
              {isAddingPasskey ? "Adding…" : "Add passkey"}
            </Button>
          </div>
          <ScrollArea className="h-[180px] rounded-md border border-white/10">
            {isLoadingPasskeys ? (
              <p className="p-3 text-center text-biolum-faint text-sm">
                Loading passkeys…
              </p>
            ) : passkeys.length === 0 ? (
              <p className="p-3 text-center text-biolum-faint text-sm">
                No passkeys yet.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {passkeys.map((passkey) => (
                  <li
                    className="flex items-center justify-between p-3"
                    key={passkey.id}
                  >
                    <div>
                      <p className="font-medium text-sm">{passkey.name}</p>
                      {passkey.deviceType && (
                        <p className="text-biolum-faint text-xs">
                          {passkey.deviceType}
                        </p>
                      )}
                      {passkey.createdAt && (
                        <p className="text-biolum-faint text-xs">
                          Added{" "}
                          {new Date(passkey.createdAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Button
                      aria-label="Delete passkey"
                      onClick={() => handleDeletePasskey(passkey.id)}
                      size="icon"
                      variant="ghost"
                    >
                      <Fingerprint className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </section>
      </div>
    </MindscapeNode>
  );
}
