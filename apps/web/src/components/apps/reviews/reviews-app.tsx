/**
 * Reviews Application - Phase 2 Web Desktop Expansion
 *
 * Unified review management interface consolidating:
 * - Review Queue: Pending AI action reviews (tools, memory, workflow, code)
 * - PR Reviews: GitHub pull request review and merge
 * - Code Reviews: Local file and agent output reviews
 *
 * Architecture: Sections pattern per .ruler/58-desktop-app-organization.md
 * Each section is self-contained with its own tRPC queries and UI state.
 *
 * @see docs/execplans/alfred-web-unification.md Milestone 5
 */

import { Clock, Code, GitPullRequest, Inbox, Shield } from "lucide-react";
import { useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { CodeReviewsSection } from "./sections/code-reviews";
import { PRReviewsSection } from "./sections/pr-reviews";
import { ReviewQueueSection } from "./sections/review-queue";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type ReviewsSection = "queue" | "prs" | "code";

interface SectionConfig {
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  id: ReviewsSection;
  label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function ReviewsApp({ window: _window }: WindowComponentProps) {
  const [section, setSection] = useState<ReviewsSection>("queue");

  // Section definitions with metadata
  const sections: SectionConfig[] = [
    {
      id: "queue",
      icon: Inbox,
      label: "Review Queue",
      description: "Pending AI actions requiring approval",
    },
    {
      id: "prs",
      icon: GitPullRequest,
      label: "Pull Requests",
      description: "GitHub PR review and merge",
    },
    {
      id: "code",
      icon: Code,
      label: "Code Reviews",
      description: "Local file and agent output reviews",
    },
  ];

  const activeSection = sections.find((s) => s.id === section);

  return (
    <div className="flex h-full bg-void">
      {/* Sidebar Navigation */}
      <aside className="flex w-64 flex-col border-white/5 border-r">
        {/* Header */}
        <header className="flex h-12 items-center gap-2 border-white/5 border-b px-4">
          <Shield className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Reviews</span>
        </header>

        {/* Section List */}
        <ScrollArea className="flex-1">
          <nav className="space-y-1 p-3" role="tablist">
            {sections.map((s) => (
              <SectionButton
                active={section === s.id}
                description={s.description}
                icon={s.icon}
                key={s.id}
                label={s.label}
                onClick={() => setSection(s.id)}
              />
            ))}
          </nav>
        </ScrollArea>

        {/* Footer Info */}
        <footer className="border-white/5 border-t p-3">
          <div className="flex items-center gap-2 text-biolum-faint text-xs">
            <Clock className="h-3 w-3" />
            <span>Auto-refresh enabled</span>
          </div>
        </footer>
      </aside>

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Section Header */}
        <header className="flex h-12 items-center justify-between border-white/5 border-b px-4">
          <div className="flex items-center gap-2">
            {activeSection && (
              <>
                <activeSection.icon className="h-4 w-4 text-biolum" />
                <h1 className="font-medium text-sm">{activeSection.label}</h1>
              </>
            )}
          </div>
        </header>

        {/* Section Content */}
        <div className="flex-1 overflow-hidden">
          {section === "queue" && <ReviewQueueSection />}
          {section === "prs" && <PRReviewsSection />}
          {section === "code" && <CodeReviewsSection />}
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

interface SectionButtonProps {
  active: boolean;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}

function SectionButton({
  active,
  description,
  icon: Icon,
  label,
  onClick,
}: SectionButtonProps) {
  return (
    <button
      aria-selected={active}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-all",
        active
          ? "bg-biolum/15 text-biolum ring-1 ring-biolum/30"
          : "text-biolum-dim hover:bg-white/5 hover:text-biolum"
      )}
      onClick={onClick}
      role="tab"
      type="button"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="font-medium text-sm">{label}</span>
      </div>
      <span
        className={cn(
          "ml-6 text-xs",
          active ? "text-biolum/70" : "text-biolum-faint"
        )}
      >
        {description}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export function ReviewsAppWindow(props: WindowComponentProps) {
  return <ReviewsApp {...props} />;
}

export default ReviewsApp;
