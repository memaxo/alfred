"use client";

/**
 * Terminal Instance - XTerm.js wrapper
 *
 * Note: This is a placeholder. Full XTerm integration requires:
 * - xterm package
 * - @xterm/addon-fit
 * - @xterm/addon-web-links
 * - WebSocket connection to backend
 */

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type TerminalProfile = {
  id: string;
  name: string;
  type: "local" | "ssh" | "docker";
  shell?: string;
  host?: string;
  container?: string;
};

type TerminalInstanceProps = {
  tabId: string;
  profile: TerminalProfile;
  className?: string;
};

export function TerminalInstance({
  tabId,
  profile,
  className,
}: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Placeholder - will integrate actual XTerm.js
  useEffect(() => {
    // TODO: Initialize xterm
    // const term = new Terminal({
    //   theme: alfredVoidTheme,
    //   fontFamily: 'Berkeley Mono, monospace',
    //   fontSize: 14,
    // });
    // term.open(containerRef.current);
    // term.loadAddon(new FitAddon());
  }, [tabId]);

  return (
    <div
      className={cn("overflow-hidden bg-void p-2 font-mono text-sm", className)}
      ref={containerRef}
    >
      {/* Placeholder terminal UI */}
      <div className="text-biolum-dim">
        <div className="mb-2 text-green-400">
          {profile.type === "docker"
            ? `docker exec -it ${profile.container} /bin/bash`
            : profile.type === "ssh"
              ? `ssh ${profile.host}`
              : (profile.shell ?? "zsh")}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-biolum">❯</span>
          <span className="animate-pulse">▌</span>
        </div>
      </div>

      {/* Connection status */}
      <div className="absolute right-2 bottom-2 flex items-center gap-1 text-biolum-dim text-xs">
        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
        <span>Connected</span>
      </div>
    </div>
  );
}
