/**
 * Deploy Application - Main Component
 *
 * Unified deployment management interface with sections:
 * - Deployments: List and manage all deployments
 * - Create Preview: Form for new preview deployments
 * - Health Monitor: Real-time deployment health status
 */

import { Activity, Cloud, Plus, Radio, Rocket } from "lucide-react";
import { useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { CreatePreviewSection } from "./sections/create-preview";
import { DeploymentsSection } from "./sections/deployments";
import { HealthMonitorSection } from "./sections/health-monitor";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type DeploySection = "deployments" | "create" | "health";

interface SectionConfig {
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  id: DeploySection;
  label: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function DeployApp({ window: _window }: WindowComponentProps) {
  const [section, setSection] = useState<DeploySection>("deployments");

  // Section definitions
  const sections: SectionConfig[] = [
    {
      id: "deployments",
      icon: Cloud,
      label: "Deployments",
      description: "Manage preview and production deployments",
    },
    {
      id: "create",
      icon: Plus,
      label: "Create Preview",
      description: "Deploy a new preview environment",
    },
    {
      id: "health",
      icon: Activity,
      label: "Health Monitor",
      description: "Real-time deployment health status",
    },
  ];

  const activeSection = sections.find((s) => s.id === section);

  return (
    <div className="flex h-full bg-void">
      {/* Sidebar Navigation */}
      <aside className="flex w-64 flex-col border-white/5 border-r">
        {/* Header */}
        <header className="flex h-12 items-center gap-2 border-white/5 border-b px-4">
          <Rocket className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Deploy</span>
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
            <Radio className="h-3 w-3" />
            <span>Live connection</span>
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
          {section === "deployments" && <DeploymentsSection />}
          {section === "create" && <CreatePreviewSection />}
          {section === "health" && <HealthMonitorSection />}
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

export function DeployAppWindow(props: WindowComponentProps) {
  return <DeployApp {...props} />;
}

export default DeployApp;
