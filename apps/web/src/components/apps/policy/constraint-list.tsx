"use client";

/**
 * Constraint List - Active autonomy constraints
 */

import { Lock, Shield, Unlock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Constraint = {
  id: string;
  name: string;
  description: string;
  scope: string;
  active: boolean;
  level: "strict" | "moderate" | "relaxed";
};

const mockConstraints: Constraint[] = [
  {
    id: "1",
    name: "File System Access",
    description: "Restrict file operations to workspace directory",
    scope: "filesystem",
    active: true,
    level: "strict",
  },
  {
    id: "2",
    name: "Network Requests",
    description: "Require approval for external API calls",
    scope: "network",
    active: true,
    level: "moderate",
  },
  {
    id: "3",
    name: "Git Operations",
    description: "Allow commits, require approval for pushes",
    scope: "git",
    active: true,
    level: "moderate",
  },
  {
    id: "4",
    name: "Package Installation",
    description: "Allow installing packages from npm registry",
    scope: "dependencies",
    active: false,
    level: "relaxed",
  },
  {
    id: "5",
    name: "Shell Execution",
    description: "Restrict shell commands to safe list",
    scope: "shell",
    active: true,
    level: "strict",
  },
];

const levelColors = {
  strict: "border-red-500/50 bg-red-500/10",
  moderate: "border-yellow-500/50 bg-yellow-500/10",
  relaxed: "border-green-500/50 bg-green-500/10",
};

export function ConstraintList() {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        {mockConstraints.map((constraint) => (
          <div
            className={cn(
              "rounded-lg border p-3",
              constraint.active
                ? levelColors[constraint.level]
                : "border-white/10 bg-white/5 opacity-50"
            )}
            key={constraint.id}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-biolum" />
                <span className="font-medium">{constraint.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-xs capitalize",
                    constraint.level === "strict" &&
                      "bg-red-500/20 text-red-400",
                    constraint.level === "moderate" &&
                      "bg-yellow-500/20 text-yellow-400",
                    constraint.level === "relaxed" &&
                      "bg-green-500/20 text-green-400"
                  )}
                >
                  {constraint.level}
                </span>
                {constraint.active ? (
                  <Lock className="h-4 w-4 text-biolum" />
                ) : (
                  <Unlock className="h-4 w-4 text-biolum-dim" />
                )}
              </div>
            </div>
            <p className="mt-1 text-biolum-dim text-sm">
              {constraint.description}
            </p>
            <div className="mt-2 text-biolum-dim text-xs">
              Scope: <span className="font-mono">{constraint.scope}</span>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
