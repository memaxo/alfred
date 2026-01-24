"use client";

import { Container, Server, Terminal, X } from "lucide-react";
import { useCallback, useState } from "react";

import type { TerminalProfile } from "@/store/terminal";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ProfileDialogProps = {
  profile?: TerminalProfile;
  onSave: (profile: Omit<TerminalProfile, "id">) => void;
  onClose: () => void;
  className?: string;
};

type ProfileType = "local" | "ssh" | "docker";

const typeOptions: {
  type: ProfileType;
  label: string;
  icon: typeof Terminal;
}[] = [
  { type: "local", label: "Local Shell", icon: Terminal },
  { type: "ssh", label: "SSH Connection", icon: Server },
  { type: "docker", label: "Docker Container", icon: Container },
];

export function ProfileDialog({
  profile,
  onSave,
  onClose,
  className,
}: ProfileDialogProps) {
  const [type, setType] = useState<ProfileType>(profile?.type ?? "local");
  const [name, setName] = useState(profile?.name ?? "");
  const [shell, setShell] = useState(profile?.shell ?? "zsh");
  const [host, setHost] = useState(profile?.host ?? "");
  const [port, setPort] = useState(profile?.port?.toString() ?? "22");
  const [username, setUsername] = useState(profile?.username ?? "");
  const [container, setContainer] = useState(profile?.container ?? "");
  const [cwd, setCwd] = useState(profile?.cwd ?? "");

  const handleSave = useCallback(() => {
    const baseProfile = {
      name: name || `New ${type} profile`,
      type,
      cwd: cwd || undefined,
    };

    if (type === "local") {
      onSave({ ...baseProfile, shell });
    } else if (type === "ssh") {
      onSave({
        ...baseProfile,
        host,
        port: Number.parseInt(port, 10) || 22,
        username: username || undefined,
      });
    } else {
      onSave({ ...baseProfile, container });
    }
  }, [type, name, shell, host, port, username, container, cwd, onSave]);

  const isValid =
    name.trim() &&
    (type === "local" ||
      (type === "ssh" && host.trim()) ||
      (type === "docker" && container.trim()));

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className={cn(
          "w-96 rounded-xl border border-white/10 bg-void-surface shadow-xl",
          className
        )}
      >
        <div className="flex items-center justify-between border-white/5 border-b p-3">
          <span className="font-medium text-sm">
            {profile ? "Edit Profile" : "New Profile"}
          </span>
          <Button
            className="h-6 w-6"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 p-4">
          {/* Type Selection */}
          <div className="flex gap-2">
            {typeOptions.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-lg p-2 transition-colors",
                    type === opt.type
                      ? "bg-biolum/20 text-biolum"
                      : "bg-white/5 text-biolum-dim hover:bg-white/10"
                  )}
                  key={opt.type}
                  onClick={() => setType(opt.type)}
                  type="button"
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Name */}
          <div>
            <label className="mb-1 block text-biolum-dim text-xs">Name</label>
            <Input
              className="bg-white/5"
              onChange={(e) => setName(e.target.value)}
              placeholder="Profile name"
              value={name}
            />
          </div>

          {/* Local Shell Options */}
          {type === "local" && (
            <>
              <div>
                <label className="mb-1 block text-biolum-dim text-xs">
                  Shell
                </label>
                <Input
                  className="bg-white/5"
                  onChange={(e) => setShell(e.target.value)}
                  placeholder="/bin/zsh"
                  value={shell}
                />
              </div>
              <div>
                <label className="mb-1 block text-biolum-dim text-xs">
                  Working Directory (optional)
                </label>
                <Input
                  className="bg-white/5"
                  onChange={(e) => setCwd(e.target.value)}
                  placeholder="~"
                  value={cwd}
                />
              </div>
            </>
          )}

          {/* SSH Options */}
          {type === "ssh" && (
            <>
              <div>
                <label className="mb-1 block text-biolum-dim text-xs">
                  Host
                </label>
                <Input
                  className="bg-white/5"
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="hostname or IP"
                  value={host}
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-biolum-dim text-xs">
                    Username (optional)
                  </label>
                  <Input
                    className="bg-white/5"
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="user"
                    value={username}
                  />
                </div>
                <div className="w-20">
                  <label className="mb-1 block text-biolum-dim text-xs">
                    Port
                  </label>
                  <Input
                    className="bg-white/5"
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="22"
                    value={port}
                  />
                </div>
              </div>
            </>
          )}

          {/* Docker Options */}
          {type === "docker" && (
            <div>
              <label className="mb-1 block text-biolum-dim text-xs">
                Container Name or ID
              </label>
              <Input
                className="bg-white/5"
                onChange={(e) => setContainer(e.target.value)}
                placeholder="container-name"
                value={container}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-white/5 border-t p-3">
          <Button onClick={onClose} size="sm" variant="ghost">
            Cancel
          </Button>
          <Button disabled={!isValid} onClick={handleSave} size="sm">
            {profile ? "Save" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
