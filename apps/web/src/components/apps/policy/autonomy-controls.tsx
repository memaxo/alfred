"use client";

/**
 * Autonomy Controls - Adjust autonomy levels per scope
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AutonomyScope } from "./index";

const mockScopes: AutonomyScope[] = [
  {
    id: "filesystem",
    name: "File System",
    description: "Read, write, and delete files",
    level: 3,
    maxLevel: 5,
  },
  {
    id: "git",
    name: "Git Operations",
    description: "Commits, branches, pushes",
    level: 2,
    maxLevel: 5,
  },
  {
    id: "network",
    name: "Network Access",
    description: "HTTP requests and API calls",
    level: 1,
    maxLevel: 5,
  },
  {
    id: "shell",
    name: "Shell Commands",
    description: "Execute terminal commands",
    level: 2,
    maxLevel: 5,
  },
  {
    id: "database",
    name: "Database Access",
    description: "Query and modify databases",
    level: 3,
    maxLevel: 5,
  },
];

const levelLabels = ["None", "Minimal", "Low", "Medium", "High", "Full"];

export function AutonomyControls() {
  const [scopes, setScopes] = useState(mockScopes);

  const handleLevelChange = (scopeId: string, level: number) => {
    setScopes((prev) =>
      prev.map((s) => (s.id === scopeId ? { ...s, level } : s))
    );
  };

  return (
    <div className="space-y-6 p-4">
      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="mb-2 font-medium">Global Autonomy</div>
        <p className="mb-3 text-biolum-dim text-sm">
          Set the overall autonomy level for ALFRED. Individual scopes can be
          adjusted below.
        </p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((level) => (
            <Button className="flex-1" key={level} size="sm" variant="outline">
              {levelLabels[level]}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {scopes.map((scope) => (
          <div
            className="rounded-lg border border-white/10 bg-white/5 p-3"
            key={scope.id}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium">{scope.name}</span>
              <span className="text-biolum text-sm">
                Level {scope.level}: {levelLabels[scope.level]}
              </span>
            </div>
            <p className="mb-3 text-biolum-dim text-xs">{scope.description}</p>
            <input
              className="w-full accent-biolum"
              max={scope.maxLevel}
              min={0}
              onChange={(e) =>
                handleLevelChange(scope.id, Number.parseInt(e.target.value, 10))
              }
              type="range"
              value={scope.level}
            />
            <div className="mt-1 flex justify-between text-biolum-dim text-xs">
              <span>None</span>
              <span>Full</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
