"use client";

/**
 * Profile Selector - Terminal profile selection modal
 */

import { Container, Server, Terminal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TerminalProfile = {
  id: string;
  name: string;
  type: "local" | "ssh" | "docker";
  shell?: string;
  host?: string;
  container?: string;
};

type ProfileSelectorProps = {
  profiles: TerminalProfile[];
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
  profiles,
  onSelect,
  onClose,
  className,
}: ProfileSelectorProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className={cn(
          "w-80 rounded-xl border border-white/10 bg-void-surface shadow-xl",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-white/5 border-b p-3">
          <span className="font-medium text-sm">New Terminal</span>
          <Button
            className="h-6 w-6"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Profiles */}
        <div className="p-2">
          {profiles.map((profile) => {
            const Icon = typeIcons[profile.type];
            return (
              <button
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/5"
                key={profile.id}
                onClick={() => onSelect(profile)}
                type="button"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
                  <Icon className="h-4 w-4 text-biolum" />
                </div>
                <div>
                  <div className="font-medium text-sm">{profile.name}</div>
                  <div className="text-biolum-dim text-xs">
                    {profile.type === "local" && profile.shell}
                    {profile.type === "ssh" && profile.host}
                    {profile.type === "docker" && profile.container}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-white/5 border-t p-2">
          <Button
            className="w-full justify-start gap-2"
            size="sm"
            variant="ghost"
          >
            <Terminal className="h-4 w-4" />
            Configure Profiles...
          </Button>
        </div>
      </div>
    </div>
  );
}
