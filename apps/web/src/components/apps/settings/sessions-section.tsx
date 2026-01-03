"use client";

/**
 * Sessions Section - Manage active authentication sessions
 *
 * View, manage, and revoke active sessions across devices.
 *
 * @see @alfred/auth package
 */

import {
  Globe,
  Monitor,
  Shield,
  Smartphone,
  Tablet,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Session = {
  id: string;
  device: "desktop" | "mobile" | "tablet" | "browser";
  name: string;
  location: string;
  lastActive: Date;
  current: boolean;
  ip: string;
};

const mockSessions: Session[] = [
  {
    id: "1",
    device: "desktop",
    name: "MacBook Pro",
    location: "San Francisco, CA",
    lastActive: new Date(),
    current: true,
    ip: "192.168.1.1",
  },
  {
    id: "2",
    device: "mobile",
    name: "iPhone 15 Pro",
    location: "San Francisco, CA",
    lastActive: new Date(Date.now() - 1000 * 60 * 30),
    current: false,
    ip: "192.168.1.2",
  },
  {
    id: "3",
    device: "browser",
    name: "Chrome on Windows",
    location: "New York, NY",
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24),
    current: false,
    ip: "10.0.0.5",
  },
];

const deviceIcons = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  browser: Globe,
};

export function SessionsSection() {
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-lg">Active Sessions</h2>
        <Button className="gap-1" size="sm" variant="outline">
          <Shield className="h-3 w-3" />
          Revoke All Others
        </Button>
      </div>

      <ScrollArea className="h-[calc(100%-60px)]">
        <div className="space-y-3">
          {mockSessions.map((session) => {
            const Icon = deviceIcons[session.device];

            return (
              <div
                className={cn(
                  "rounded-lg border p-4",
                  session.current
                    ? "border-biolum/50 bg-biolum/10"
                    : "border-white/10 bg-white/5"
                )}
                key={session.id}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        session.current ? "bg-biolum/20" : "bg-white/10"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5",
                          session.current ? "text-biolum" : "text-biolum-dim"
                        )}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{session.name}</span>
                        {session.current && (
                          <span className="rounded bg-biolum/20 px-1.5 py-0.5 text-biolum text-xs">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-biolum-dim text-sm">
                        {session.location}
                      </div>
                      <div className="mt-1 flex gap-4 text-xs">
                        <span className="text-biolum-dim">
                          Last active: {formatLastActive(session.lastActive)}
                        </span>
                        <span className="font-mono text-biolum-dim">
                          {session.ip}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!session.current && (
                    <Button
                      className="gap-1 text-red-400 hover:bg-red-500/20 hover:text-red-400"
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="h-3 w-3" />
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function formatLastActive(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}
