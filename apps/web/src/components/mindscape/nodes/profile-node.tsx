import type { NodeProps } from "@xyflow/react";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { Fingerprint, UserCircle2, Volume2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MindscapeNode } from "./mindscape-node";
import { profileNodeDataSchema } from "@/store/mindscape.schemas";
import { useMindscapeStore } from "@/store/mindscape";
import { authClient } from "@/lib/auth-client";
import { trpc, type TRPCAppRouter } from "@/utils/trpc";
import { VoiceSelector } from "@/components/voice-selector";

const EMPTY_STATE = {
  name: "",
  email: "",
  avatar: "",
  timezone: "",
};

type ProfileRow = inferRouterOutputs<TRPCAppRouter>["profile"]["get"];
type ProfileUpdateInput = inferRouterInputs<TRPCAppRouter>["profile"]["update"];

type PasskeyInfo = {
  id: string;
  name: string;
  deviceType?: string;
  createdAt?: Date;
};

export function ProfileNode({ id, data, selected }: NodeProps) {
  const parsed = profileNodeDataSchema.safeParse(data);
  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );

  const [form, setForm] = useState(EMPTY_STATE);
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [isAddingPasskey, setIsAddingPasskey] = useState(false);
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(false);

  const utils = trpc.useUtils();
  const profileQuery = trpc.profile.get.useQuery();
  const profile = profileQuery.data;
  const isLoadingProfile = profileQuery.isLoading;

  // Preference query for voice settings
  const preferenceQuery = trpc.preference.list.useQuery({ limit: 100, offset: 0 });
  const preferences = preferenceQuery.data ?? [];
  
  const currentVoice = useMemo(() => {
    const pref = preferences.find(p => p.key === "voice.tts");
    if (!pref?.value) return undefined;
    
    // Handle potential JSON string encoding
    if (typeof pref.value === "string") {
      try {
        // Check if it's a double-encoded string
        if (pref.value.startsWith('"') && pref.value.endsWith('"')) {
             return JSON.parse(pref.value);
        }
      } catch {
        // ignore
      }
      return pref.value;
    }
    return undefined;
  }, [preferences]);

  const currentLanguage = useMemo(() => {
    const pref = preferences.find(p => p.key === "voice.stt.language");
    if (!pref?.value) return undefined;
    
    if (typeof pref.value === "string") {
        try {
            if (pref.value.startsWith('"') && pref.value.endsWith('"')) {
                return JSON.parse(pref.value);
            }
        } catch {}
        return pref.value;
    }
    return undefined;
  }, [preferences]);

  const setPreference = trpc.preference.set.useMutation({
    onSuccess: async () => {
        toast.success("Preference saved");
        await utils.preference.list.invalidate();
    },
    onError: (error) => {
        toast.error(error.message ?? "preference_update_failed");
    }
  });

  const handleVoiceChange = (voice: string) => {
     setPreference.mutate({
         key: "voice.tts",
         value: voice,
         confidence: 1,
         source: "user"
     });
  };

  const handleLanguageChange = (lang: string) => {
    setPreference.mutate({
        key: "voice.stt.language",
        value: lang,
        confidence: 1,
        source: "user"
    });
  };

  useEffect(() => {
    if (profile) {
      const next = {
        name: profile.name ?? "",
        email: profile.email ?? "",
        avatar: profile.avatar ?? "",
        timezone: profile.timezone ?? "",
      };
      setForm(next);
      updateArtifactData(id, { lastUpdatedAt: new Date().toISOString() });
    } else if (!profileQuery.isFetching) {
      setForm(EMPTY_STATE);
    }
  }, [profile, profileQuery.isFetching, id, updateArtifactData]);

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

  const normalizedProfile = useMemo(() => {
    if (!profile) return EMPTY_STATE;
    return {
      name: profile.name ?? "",
      email: profile.email ?? "",
      avatar: profile.avatar ?? "",
      timezone: profile.timezone ?? "",
    };
  }, [profile]);

  const hasChanges = useMemo(() => {
    return (
      form.name.trim() !== normalizedProfile.name ||
      form.email.trim() !== normalizedProfile.email ||
      form.avatar.trim() !== normalizedProfile.avatar ||
      form.timezone.trim() !== normalizedProfile.timezone
    );
  }, [form, normalizedProfile]);

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

  const prepareInput = (): ProfileUpdateInput => {
    const payload: ProfileUpdateInput = {};
    payload.name = form.name.trim() || null;
    payload.email = form.email.trim() || null;
    payload.avatar = form.avatar.trim() || null;
    if (form.timezone.trim()) {
      payload.timezone = form.timezone.trim();
    }
    return payload;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasChanges || updateProfile.isPending) {
      return;
    }
    updateProfile.mutate(prepareInput());
  };

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

  return (
    <MindscapeNode
      className="w-[420px] border-indigo-500/20 bg-indigo-950/10"
      headerActions={<UserCircle2 className="h-4 w-4 text-indigo-200" />}
      id={id}
      selected={selected}
      title="Profile"
    >
      <div className="flex flex-col gap-4 p-4">
        <form className="space-y-2" onSubmit={handleSubmit}>
          <Input
            autoComplete="name"
            disabled={isLoadingProfile || updateProfile.isPending}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder="Name"
            value={form.name}
          />
          <Input
            autoComplete="email"
            disabled={isLoadingProfile || updateProfile.isPending}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, email: event.target.value }))
            }
            placeholder="Email"
            type="email"
            value={form.email}
          />
          <Input
            disabled={isLoadingProfile || updateProfile.isPending}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, avatar: event.target.value }))
            }
            placeholder="Avatar URL"
            type="url"
            value={form.avatar}
          />
          <Input
            disabled={isLoadingProfile || updateProfile.isPending}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, timezone: event.target.value }))
            }
            placeholder="Timezone (e.g. America/New_York)"
            value={form.timezone}
          />
          <Button
            className="w-full"
            disabled={!hasChanges || updateProfile.isPending || isLoadingProfile}
            type="submit"
          >
            {updateProfile.isPending ? "Saving…" : "Save changes"}
          </Button>
        </form>

        <section className="space-y-2">
           <div className="flex items-center justify-between">
            <p className="text-biolum text-sm font-medium">Voice</p>
            <Volume2 className="h-4 w-4 text-indigo-200" />
           </div>
           <VoiceSelector 
              value={currentVoice as string | undefined}
              onValueChange={handleVoiceChange}
           />
        </section>

        <section className="space-y-2">
           <div className="flex items-center justify-between">
            <p className="text-biolum text-sm font-medium">Language</p>
           </div>
           <Input
              placeholder="e.g. en, es, fr (Auto if empty)"
              value={(currentLanguage as string) ?? ""}
              onChange={(e) => handleLanguageChange(e.target.value)}
           />
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-biolum text-sm font-medium">Passkeys</p>
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
              <p className="p-3 text-center text-sm text-biolum-faint">
                Loading passkeys…
              </p>
            ) : passkeys.length === 0 ? (
              <p className="p-3 text-center text-sm text-biolum-faint">
                No passkeys yet.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {passkeys.map((passkey) => (
                  <li className="flex items-center justify-between p-3" key={passkey.id}>
                    <div>
                      <p className="text-sm font-medium">{passkey.name}</p>
                      {passkey.deviceType && (
                        <p className="text-xs text-biolum-faint">{passkey.deviceType}</p>
                      )}
                      {passkey.createdAt && (
                        <p className="text-xs text-biolum-faint">
                          Added {new Date(passkey.createdAt).toLocaleDateString()}
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
