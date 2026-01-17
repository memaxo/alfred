"use client";

/**
 * Profile Selector - Terminal profile selection modal
 */

import {
  Container,
  Pencil,
  Plus,
  Server,
  Star,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TerminalProfile } from "@/store/terminal";
import { useTerminalProfiles } from "@/store/terminal";
import { DockerSelector } from "./docker-selector";
import { ProfileDialog } from "./profile-dialog";

type ProfileSelectorProps = {
  onSelect: (profile: TerminalProfile) => void;
  onClose: () => void;
  className?: string;
};

const typeIcons = {
  local: Terminal,
  ssh: Server,
  docker: Container,
};

export function ProfileSelector({
  onSelect,
  onClose,
  className,
}: ProfileSelectorProps) {
  const { profiles, addProfile, updateProfile, deleteProfile, setDefault } =
    useTerminalProfiles();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TerminalProfile | null>(
    null
  );
  const [showDockerSelector, setShowDockerSelector] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);

  const handleCreateProfile = (profile: Omit<TerminalProfile, "id">) => {
    const newProfile = addProfile(profile);
    setShowCreateDialog(false);
    onSelect(newProfile);
  };

  const handleEditProfile = (profile: Omit<TerminalProfile, "id">) => {
    if (editingProfile) {
      updateProfile(editingProfile.id, profile);
      setEditingProfile(null);
    }
  };

  const handleDockerSelect = (container: { id: string; name: string }) => {
    const profile = addProfile({
      name: `Docker: ${container.name}`,
      type: "docker",
      container: container.name,
    });
    setShowDockerSelector(false);
    onSelect(profile);
  };

  return (
    <>
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div
          className={cn(
            "w-80 rounded-xl border border-white/10 bg-void-surface shadow-xl",
            className
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-white/5 border-b p-3">
            <span className="font-medium text-sm">
              {isManageMode ? "Manage Profiles" : "New Terminal"}
            </span>
            <div className="flex items-center gap-1">
              <Button
                className="h-6 w-6"
                onClick={() => setIsManageMode(!isManageMode)}
                size="icon"
                title={isManageMode ? "Done" : "Manage"}
                variant="ghost"
              >
                {isManageMode ? (
                  <X className="h-3.5 w-3.5" />
                ) : (
                  <Pencil className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                className="h-6 w-6"
                onClick={onClose}
                size="icon"
                title="Close"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Profiles */}
          <div className="max-h-64 overflow-auto p-2">
            {profiles.map((profile) => {
              const Icon = typeIcons[profile.type];
              return (
                <div
                  className="group flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/5"
                  key={profile.id}
                >
                  <button
                    className="flex flex-1 items-center gap-3"
                    disabled={isManageMode}
                    onClick={() => !isManageMode && onSelect(profile)}
                    type="button"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
                      <Icon className="h-4 w-4 text-biolum" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-medium text-sm">
                        {profile.name}
                        {profile.isDefault && (
                          <Star className="h-3 w-3 fill-biolum text-biolum" />
                        )}
                      </div>
                      <div className="truncate text-biolum-dim text-xs">
                        {profile.type === "local" && profile.shell}
                        {profile.type === "ssh" &&
                          `${profile.username ? `${profile.username}@` : ""}${profile.host}${profile.port !== 22 ? `:${profile.port}` : ""}`}
                        {profile.type === "docker" && profile.container}
                      </div>
                    </div>
                  </button>
                  {isManageMode && (
                    <div className="flex items-center gap-0.5">
                      {!profile.isDefault && (
                        <Button
                          className="h-6 w-6"
                          onClick={() => setDefault(profile.id)}
                          size="icon"
                          title="Set as default"
                          variant="ghost"
                        >
                          <Star className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        className="h-6 w-6"
                        onClick={() => setEditingProfile(profile)}
                        size="icon"
                        title="Edit"
                        variant="ghost"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {!profile.isDefault && (
                        <Button
                          className="h-6 w-6 text-red-400 hover:text-red-300"
                          onClick={() => deleteProfile(profile.id)}
                          size="icon"
                          title="Delete"
                          variant="ghost"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="space-y-1 border-white/5 border-t p-2">
            <Button
              className="w-full justify-start gap-2"
              onClick={() => setShowCreateDialog(true)}
              size="sm"
              variant="ghost"
            >
              <Plus className="h-4 w-4" />
              New Profile...
            </Button>
            <Button
              className="w-full justify-start gap-2"
              onClick={() => setShowDockerSelector(true)}
              size="sm"
              variant="ghost"
            >
              <Container className="h-4 w-4" />
              Connect to Container...
            </Button>
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      {(showCreateDialog || editingProfile) && (
        <ProfileDialog
          onClose={() => {
            setShowCreateDialog(false);
            setEditingProfile(null);
          }}
          onSave={editingProfile ? handleEditProfile : handleCreateProfile}
          profile={editingProfile ?? undefined}
        />
      )}

      {/* Docker Container Selector */}
      {showDockerSelector && (
        <DockerSelector
          onClose={() => setShowDockerSelector(false)}
          onSelect={handleDockerSelect}
        />
      )}
    </>
  );
}
