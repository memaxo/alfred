/**
 * Terminal Application - Phase 2 Core Application
 *
 * Enhanced terminal with multiple profiles, tabs, and TUI mode.
 *
 * Features:
 * - Multiple terminal tabs
 * - Profile management (SSH, local, Docker)
 * - XTerm.js integration
 * - TUI mode toggle
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 3.4
 */

import { Plus, Settings, Terminal as TerminalIcon } from "lucide-react";
import { useCallback, useState } from "react";

import type { WindowComponentProps } from "@/components/desktop/windows/types";
import type { TerminalProfile } from "@/store/terminal";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTerminalProfiles } from "@/store/terminal";

import { ProfileSelector } from "./profile-selector";
import { TerminalInstance } from "./terminal-instance";
import { TerminalTabs } from "./terminal-tabs";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface TerminalAppProps {
  windowId?: string;
  className?: string;
}

interface TerminalTab {
  id: string;
  title: string;
  profile: TerminalProfile;
  isActive: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function TerminalApp({
  windowId: _windowId,
  className,
}: TerminalAppProps) {
  const { getDefault } = useTerminalProfiles();
  const defaultProfile = getDefault();

  const [tabs, setTabs] = useState<TerminalTab[]>([
    {
      id: "1",
      title: defaultProfile.name,
      profile: defaultProfile,
      isActive: true,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("1");
  const [showProfileSelector, setShowProfileSelector] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleNewTab = useCallback(
    (profile?: TerminalProfile) => {
      const p = profile ?? defaultProfile;
      const newTab: TerminalTab = {
        id: crypto.randomUUID(),
        title: p.name,
        profile: p,
        isActive: true,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      setShowProfileSelector(false);
    },
    [defaultProfile]
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => prev.filter((t) => t.id !== tabId));
      if (activeTabId === tabId && tabs.length > 1) {
        const remaining = tabs.filter((t) => t.id !== tabId);
        setActiveTabId(remaining[0]?.id ?? "");
      }
    },
    [activeTabId, tabs]
  );

  const handleSelectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  return (
    <div
      className={cn("flex h-full w-full flex-col bg-void", className)}
      data-app="terminal"
    >
      {/* Tab Bar */}
      <div className="flex h-9 items-center justify-between border-white/5 border-b bg-void-surface px-1">
        <TerminalTabs
          activeId={activeTabId}
          onClose={handleCloseTab}
          onSelect={handleSelectTab}
          tabs={tabs}
        />

        <div className="flex items-center gap-0.5 px-1">
          <Button
            className="h-6 w-6"
            onClick={() => setShowProfileSelector(true)}
            size="icon"
            title="New Terminal"
            variant="ghost"
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            className="h-6 w-6"
            size="icon"
            title="Settings"
            variant="ghost"
          >
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Terminal Instance */}
      {activeTab ? (
        <TerminalInstance
          className="flex-1"
          profile={activeTab.profile}
          tabId={activeTab.id}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-biolum-dim">
          <div className="text-center">
            <TerminalIcon className="mx-auto mb-4 h-12 w-12 opacity-20" />
            <p>No terminal open</p>
            <Button
              className="mt-4"
              onClick={() => handleNewTab()}
              size="sm"
              variant="outline"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Terminal
            </Button>
          </div>
        </div>
      )}

      {/* Profile Selector Modal */}
      {showProfileSelector && (
        <ProfileSelector
          onClose={() => setShowProfileSelector(false)}
          onSelect={handleNewTab}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

export function TerminalAppWindow(props: WindowComponentProps) {
  return <TerminalApp className="h-full" windowId={props.window.id} />;
}

export default TerminalApp;
