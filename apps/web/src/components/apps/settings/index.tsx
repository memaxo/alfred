"use client";

/**
 * Settings App - System configuration and preferences
 *
 * Manages user preferences, sessions, tokens, and policy settings.
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 8.8
 */

import { Bell, Key, Palette, Settings, Shield, User } from "lucide-react";
import { useState } from "react";
import type { WindowComponentProps } from "@/components/desktop/windows/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { PolicySection } from "./policy-section";
import { SessionsSection } from "./sessions-section";
import { TokensSection } from "./tokens-section";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type SettingsSection =
  | "account"
  | "sessions"
  | "tokens"
  | "policy"
  | "appearance"
  | "notifications";

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function SettingsApp({ window: _window }: WindowComponentProps) {
  const [section, setSection] = useState<SettingsSection>("sessions");

  const sections = [
    { id: "account", icon: User, label: "Account" },
    { id: "sessions", icon: Key, label: "Sessions" },
    { id: "tokens", icon: Key, label: "API Tokens" },
    { id: "policy", icon: Shield, label: "Policy" },
    { id: "appearance", icon: Palette, label: "Appearance" },
    { id: "notifications", icon: Bell, label: "Notifications" },
  ] as const;

  return (
    <div className="flex h-full bg-void">
      {/* Sidebar */}
      <div className="w-48 border-white/5 border-r">
        <div className="flex h-10 items-center gap-2 border-white/5 border-b px-3">
          <Settings className="h-4 w-4 text-biolum" />
          <span className="font-medium text-sm">Settings</span>
        </div>

        <ScrollArea className="h-[calc(100%-40px)]">
          <div className="space-y-1 p-2">
            {sections.map((s) => (
              <button
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  section === s.id
                    ? "bg-biolum/20 text-biolum"
                    : "text-biolum-dim hover:bg-white/5 hover:text-biolum"
                )}
                key={s.id}
                onClick={() => setSection(s.id)}
                type="button"
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {section === "account" && <AccountSection />}
        {section === "sessions" && <SessionsSection />}
        {section === "tokens" && <TokensSection />}
        {section === "policy" && <PolicySection />}
        {section === "appearance" && <AppearanceSection />}
        {section === "notifications" && <NotificationsSection />}
      </div>
    </div>
  );
}

// Placeholder sections
function AccountSection() {
  return (
    <div className="p-6">
      <h2 className="mb-4 font-semibold text-lg">Account</h2>
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-biolum/20">
            <User className="h-8 w-8 text-biolum" />
          </div>
          <div>
            <div className="font-medium">Jack Mazac</div>
            <div className="text-biolum-dim text-sm">jack@example.com</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppearanceSection() {
  return (
    <div className="p-6">
      <h2 className="mb-4 font-semibold text-lg">Appearance</h2>
      <div className="space-y-4">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="mb-2 font-medium">Theme</div>
          <div className="flex gap-2">
            {["Dark", "Light", "System"].map((theme) => (
              <button
                className={cn(
                  "rounded-lg border px-4 py-2 text-sm transition-colors",
                  theme === "Dark"
                    ? "border-biolum bg-biolum/20 text-biolum"
                    : "border-white/10 hover:border-white/20"
                )}
                key={theme}
                type="button"
              >
                {theme}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsSection() {
  return (
    <div className="p-6">
      <h2 className="mb-4 font-semibold text-lg">Notifications</h2>
      <div className="space-y-4">
        {[
          {
            label: "Agent completions",
            description: "Notify when agents finish tasks",
          },
          {
            label: "Workflow events",
            description: "Notify on workflow state changes",
          },
          {
            label: "System alerts",
            description: "Critical system notifications",
          },
        ].map((setting) => (
          <div
            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4"
            key={setting.label}
          >
            <div>
              <div className="font-medium">{setting.label}</div>
              <div className="text-biolum-dim text-sm">
                {setting.description}
              </div>
            </div>
            <input className="accent-biolum" defaultChecked type="checkbox" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsAppWindow(props: WindowComponentProps) {
  return <SettingsApp {...props} />;
}
