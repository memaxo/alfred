import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TerminalProfile = {
  id: string;
  name: string;
  type: "local" | "ssh" | "docker";
  shell?: string;
  host?: string;
  port?: number;
  username?: string;
  container?: string;
  cwd?: string;
  isDefault?: boolean;
};

type TerminalProfileStore = {
  profiles: TerminalProfile[];
  addProfile: (profile: Omit<TerminalProfile, "id">) => TerminalProfile;
  updateProfile: (id: string, updates: Partial<TerminalProfile>) => void;
  deleteProfile: (id: string) => void;
  setDefault: (id: string) => void;
  getDefault: () => TerminalProfile;
};

const DEFAULT_PROFILES: TerminalProfile[] = [
  {
    id: "local-default",
    name: "Local",
    type: "local",
    // Browser-safe default. Users can override per-profile.
    shell: "zsh",
    isDefault: true,
  },
];

export const useTerminalProfiles = create<TerminalProfileStore>()(
  persist(
    (set, get) => ({
      profiles: DEFAULT_PROFILES,

      addProfile: (profile) => {
        const newProfile: TerminalProfile = {
          ...profile,
          id: crypto.randomUUID(),
        };
        set((state) => ({
          profiles: [...state.profiles, newProfile],
        }));
        return newProfile;
      },

      updateProfile: (id, updates) => {
        set((state) => ({
          profiles: state.profiles.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      deleteProfile: (id) => {
        const profile = get().profiles.find((p) => p.id === id);
        if (profile?.isDefault) {
          return;
        }
        set((state) => ({
          profiles: state.profiles.filter((p) => p.id !== id),
        }));
      },

      setDefault: (id) => {
        set((state) => ({
          profiles: state.profiles.map((p) => ({
            ...p,
            isDefault: p.id === id,
          })),
        }));
      },

      getDefault: () => {
        const { profiles } = get();
        const defaultProfile = profiles.find((p) => p.isDefault);
        if (defaultProfile) {
          return defaultProfile;
        }
        if (profiles.length > 0) {
          return profiles[0] as TerminalProfile;
        }
        return DEFAULT_PROFILES[0] as TerminalProfile;
      },
    }),
    {
      name: "terminal-profiles-v1",
      version: 1,
    }
  )
);
