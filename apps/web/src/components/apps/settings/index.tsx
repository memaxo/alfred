"use client";

/**
 * Settings App - Unified system configuration and preferences
 *
 * Consolidated settings UI with 10 categories:
 * - Profile: User account information
 * - Devices: Session and device management
 * - Security: API tokens, passkeys, policy permissions
 * - Models: AI model configuration per role
 * - Voice: Speech-to-text and text-to-speech
 * - Embeddings: Embedding model configuration
 * - Visual: Desktop appearance and effects
 * - MCP: Model Context Protocol servers
 * - Integrations: External service connections
 * - Notifications: Alert preferences
 * - Keyboard: Shortcut customization
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 8.8
 */

import {
  Bell,
  Cpu,
  Keyboard,
  Mic,
  Palette,
  Plug,
  Settings,
  Shield,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { useState } from "react";
import type { WindowComponentProps } from "@/components/desktop/windows/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { PolicySection } from "./policy-section";
import { EmbeddingsSection } from "./sections/embeddings";
import { IntegrationsSection } from "./sections/integrations";
import { KeyboardSection } from "./sections/keyboard";
import { McpSection } from "./sections/mcp";
import { ModelsSection } from "./sections/models";
import { NotificationsSection } from "./sections/notifications";
import { ProfileSection } from "./sections/profile";
import { VisualSection } from "./sections/visual";
import { VoiceSection } from "./sections/voice";
import { SessionsSection } from "./sessions-section";
import { TokensSection } from "./tokens-section";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type SettingsSection =
  | "profile"
  | "devices"
  | "security"
  | "models"
  | "voice"
  | "embeddings"
  | "visual"
  | "mcp"
  | "integrations"
  | "notifications"
  | "keyboard";

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function SettingsApp({ window: _window }: WindowComponentProps) {
  const [section, setSection] = useState<SettingsSection>("profile");

  const sections = [
    { id: "profile", icon: User, label: "Profile" },
    { id: "devices", icon: Zap, label: "Devices & Sessions" },
    { id: "security", icon: Shield, label: "Security" },
    { id: "models", icon: Sparkles, label: "AI Models" },
    { id: "voice", icon: Mic, label: "Voice & Speech" },
    { id: "embeddings", icon: Cpu, label: "Embeddings" },
    { id: "visual", icon: Palette, label: "Visual & Desktop" },
    { id: "mcp", icon: Plug, label: "MCP Servers" },
    { id: "integrations", icon: Zap, label: "Integrations" },
    { id: "notifications", icon: Bell, label: "Notifications" },
    { id: "keyboard", icon: Keyboard, label: "Keyboard" },
  ] as const;

  return (
    <div className="flex h-full bg-void">
      {/* Sidebar */}
      <div className="w-56 border-white/5 border-r">
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
                onClick={() => setSection(s.id as SettingsSection)}
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
        {section === "profile" && <ProfileSection />}
        {section === "devices" && <DevicesSection />}
        {section === "security" && <SecuritySection />}
        {section === "models" && <ModelsSection />}
        {section === "voice" && <VoiceSection />}
        {section === "embeddings" && <EmbeddingsSection />}
        {section === "visual" && <VisualSection />}
        {section === "mcp" && <McpSection />}
        {section === "integrations" && <IntegrationsSection />}
        {section === "notifications" && <NotificationsSection />}
        {section === "keyboard" && <KeyboardSection />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function DevicesSection() {
  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="font-semibold text-lg">Devices & Sessions</h2>
        <p className="mt-1 text-biolum-dim text-sm">
          Manage active sessions and authorized devices.
        </p>
      </div>
      <SessionsSection />
    </div>
  );
}

function SecuritySection() {
  const [tab, setTab] = useState<"tokens" | "policy">("tokens");

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="font-semibold text-lg">Security</h2>
        <p className="mt-1 text-biolum-dim text-sm">
          API tokens, passkeys, and permission policies.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-4 flex gap-2 border-white/10 border-b">
        <button
          className={cn(
            "border-b-2 px-4 py-2 font-medium text-sm transition-colors",
            tab === "tokens"
              ? "border-biolum text-biolum"
              : "border-transparent text-biolum-dim hover:text-biolum"
          )}
          onClick={() => setTab("tokens")}
          type="button"
        >
          API Tokens
        </button>
        <button
          className={cn(
            "border-b-2 px-4 py-2 font-medium text-sm transition-colors",
            tab === "policy"
              ? "border-biolum text-biolum"
              : "border-transparent text-biolum-dim hover:text-biolum"
          )}
          onClick={() => setTab("policy")}
          type="button"
        >
          Policy
        </button>
      </div>

      {tab === "tokens" && <TokensSection />}
      {tab === "policy" && <PolicySection />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export function SettingsAppWindow(props: WindowComponentProps) {
  return <SettingsApp {...props} />;
}
