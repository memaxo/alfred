"use client";

/**
 * Policy Section - Configure autonomy and permission preferences
 *
 * User-facing policy preferences for ALFRED's autonomy levels.
 *
 * @see @alfred/policy package
 */

import { AlertTriangle, Info, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type PolicyPreference = {
  id: string;
  name: string;
  description: string;
  scope: string;
  level: "ask" | "allow" | "deny";
  risk: "low" | "medium" | "high";
};

const mockPreferences: PolicyPreference[] = [
  {
    id: "1",
    name: "File System Access",
    description: "Allow ALFRED to read and write files in the workspace",
    scope: "filesystem",
    level: "allow",
    risk: "low",
  },
  {
    id: "2",
    name: "Git Operations",
    description: "Allow commits, branch creation, and local git operations",
    scope: "git",
    level: "allow",
    risk: "low",
  },
  {
    id: "3",
    name: "Git Push",
    description: "Allow pushing changes to remote repositories",
    scope: "git.push",
    level: "ask",
    risk: "medium",
  },
  {
    id: "4",
    name: "Shell Commands",
    description: "Allow executing shell commands in the terminal",
    scope: "shell",
    level: "ask",
    risk: "high",
  },
  {
    id: "5",
    name: "External API Calls",
    description: "Allow making HTTP requests to external services",
    scope: "network.external",
    level: "ask",
    risk: "medium",
  },
  {
    id: "6",
    name: "Database Modifications",
    description: "Allow modifying database schemas and data",
    scope: "database.write",
    level: "ask",
    risk: "high",
  },
];

const levelColors = {
  ask: "border-yellow-500/50 bg-yellow-500/10",
  allow: "border-green-500/50 bg-green-500/10",
  deny: "border-red-500/50 bg-red-500/10",
};

const riskColors = {
  low: "text-green-400",
  medium: "text-yellow-400",
  high: "text-red-400",
};

export function PolicySection() {
  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="font-semibold text-lg">Policy Preferences</h2>
        <p className="mt-1 text-biolum-dim text-sm">
          Configure what ALFRED can do automatically vs. what requires your
          approval.
        </p>
      </div>

      {/* Info Banner */}
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-500/50 bg-blue-500/10 p-3">
        <Info className="mt-0.5 h-4 w-4 text-blue-400" />
        <div className="text-sm">
          <span className="font-medium text-blue-400">Tip:</span>{" "}
          <span className="text-blue-300">
            Start with "Ask First" for sensitive operations, then allow after
            building trust.
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {mockPreferences.map((pref) => (
          <div
            className={cn("rounded-lg border p-4", levelColors[pref.level])}
            key={pref.id}
          >
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-biolum" />
                <span className="font-medium">{pref.name}</span>
                <span className={cn("text-xs", riskColors[pref.risk])}>
                  {pref.risk} risk
                </span>
              </div>
              <select
                className="rounded border border-white/20 bg-void px-2 py-1 text-sm focus:border-biolum focus:outline-none"
                defaultValue={pref.level}
              >
                <option value="allow">Allow</option>
                <option value="ask">Ask First</option>
                <option value="deny">Deny</option>
              </select>
            </div>

            <p className="text-biolum-dim text-sm">{pref.description}</p>

            <div className="mt-2 font-mono text-biolum-dim text-xs">
              Scope: {pref.scope}
            </div>
          </div>
        ))}
      </div>

      {/* Warning */}
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-400" />
        <div className="text-sm text-yellow-300">
          Changes to policy preferences take effect immediately. Use caution
          when allowing high-risk operations automatically.
        </div>
      </div>
    </div>
  );
}
