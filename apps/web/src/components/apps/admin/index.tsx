/**
 * Admin/Ops Application - Central hub for system operations
 *
 * Consolidates metrics, voice, policy, sessions, and task management.
 *
 * @see docs/execplans/admin-desktop-devtools.md
 */

import { Activity, BarChart3, Cpu, Shield, Users, Zap } from "lucide-react";
import { useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";

import { SessionsSection } from "../settings/sessions-section";
import { MetricsDashboardView } from "./perf";
import { VoiceAdminView } from "./voice";

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function AdminApp({ window: _window }: WindowComponentProps) {
  const [tab, setTab] = useState<
    "perf" | "voice" | "policy" | "sessions" | "tasks"
  >("perf");
  const spawnWindow = useDesktopStore((s) => s.spawnWindow);

  return (
    <div className="flex h-full flex-col bg-void font-sans text-biolum-bright">
      {/* Toolbar */}
      <div className="flex h-10 items-center justify-between border-white/5 border-b bg-void-surface/50 px-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Admin & Operations</span>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Nav */}
        <div className="w-48 border-white/5 border-r bg-void-surface/20">
          <div className="flex flex-col gap-1 p-2">
            <NavButton
              active={tab === "perf"}
              icon={<BarChart3 className="h-4 w-4" />}
              label="Performance"
              onClick={() => setTab("perf")}
            />
            <NavButton
              active={tab === "voice"}
              icon={<Zap className="h-4 w-4" />}
              label="Voice Ops"
              onClick={() => setTab("voice")}
            />
            <NavButton
              active={tab === "sessions"}
              icon={<Users className="h-4 w-4" />}
              label="Sessions"
              onClick={() => setTab("sessions")}
            />
            <div className="my-2 border-white/5 border-t" />
            <div className="px-3 py-1 font-semibold text-[10px] text-biolum-dim uppercase tracking-wider">
              External Tools
            </div>
            <NavButton
              active={false}
              icon={<Shield className="h-4 w-4" />}
              label="Policy Viewer"
              onClick={() => spawnWindow("policy")}
            />
            <NavButton
              active={false}
              icon={<Activity className="h-4 w-4" />}
              label="Metrics Explorer"
              onClick={() => spawnWindow("metrics")}
            />
            <NavButton
              active={false}
              icon={<Cpu className="h-4 w-4" />}
              label="Task Manager"
              onClick={() => spawnWindow("taskmanager")}
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-void">
          {tab === "perf" && (
            <div className="mx-auto max-w-6xl p-6">
              <MetricsDashboardView />
            </div>
          )}
          {tab === "voice" && (
            <div className="mx-auto max-w-6xl p-6">
              <VoiceAdminView />
            </div>
          )}
          {tab === "sessions" && (
            <div className="h-full">
              <SessionsSection />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NavButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all",
        active
          ? "bg-biolum/10 text-biolum shadow-[inset_0_0_10px_rgba(0,243,255,0.1)]"
          : "text-biolum-dim hover:bg-white/5 hover:text-biolum"
      )}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function AdminAppWindow(props: WindowComponentProps) {
  return <AdminApp {...props} />;
}
