"use client";

/**
 * Pattern Library - Browse plan templates
 */

import { BookOpen, Copy, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Pattern {
  id: string;
  name: string;
  description: string;
  category: "feature" | "refactor" | "fix" | "migration";
  steps: number;
  uses: number;
  starred: boolean;
}

const mockPatterns: Pattern[] = [
  {
    id: "1",
    name: "Feature Implementation",
    description: "Standard pattern for adding new features with tests",
    category: "feature",
    steps: 6,
    uses: 45,
    starred: true,
  },
  {
    id: "2",
    name: "Bug Fix",
    description: "Investigate, fix, test, and document bug fixes",
    category: "fix",
    steps: 5,
    uses: 78,
    starred: true,
  },
  {
    id: "3",
    name: "Code Refactoring",
    description: "Safe refactoring with incremental changes",
    category: "refactor",
    steps: 7,
    uses: 32,
    starred: false,
  },
  {
    id: "4",
    name: "Database Migration",
    description: "Schema changes with rollback support",
    category: "migration",
    steps: 8,
    uses: 12,
    starred: false,
  },
  {
    id: "5",
    name: "API Endpoint",
    description: "Create new API endpoints with validation",
    category: "feature",
    steps: 5,
    uses: 56,
    starred: true,
  },
];

const categoryColors = {
  feature: "bg-blue-500/20 text-blue-400",
  refactor: "bg-purple-500/20 text-purple-400",
  fix: "bg-red-500/20 text-red-400",
  migration: "bg-orange-500/20 text-orange-400",
};

export function PatternLibrary() {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-4">
        {mockPatterns.map((pattern) => (
          <div
            className="rounded-lg border border-white/10 bg-white/5 p-3"
            key={pattern.id}
          >
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-biolum" />
                <span className="font-medium">{pattern.name}</span>
                {pattern.starred && (
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                )}
              </div>
              <span
                className={cn(
                  "rounded px-2 py-0.5 text-xs capitalize",
                  categoryColors[pattern.category]
                )}
              >
                {pattern.category}
              </span>
            </div>

            <p className="mb-2 text-biolum-dim text-sm">
              {pattern.description}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex gap-3 text-biolum-dim text-xs">
                <span>{pattern.steps} steps</span>
                <span>{pattern.uses} uses</span>
              </div>
              <Button className="h-7 gap-1" size="sm" variant="outline">
                <Copy className="h-3 w-3" />
                Use
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
