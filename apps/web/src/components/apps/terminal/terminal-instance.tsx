/**
 * Terminal Instance - XTerm.js wrapper
 *
 * Full XTerm integration with backend terminal session support.
 */

import type { Terminal } from "xterm";
import type { FitAddon } from "xterm-addon-fit";

import { useEffect, useRef, useState } from "react";
import "xterm/css/xterm.css";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface TerminalProfile {
  id: string;
  name: string;
  type: "local" | "ssh" | "docker";
  shell?: string;
  host?: string;
  container?: string;
}

interface TerminalInstanceProps {
  tabId: string;
  profile: TerminalProfile;
  className?: string;
}

export function TerminalInstance({
  tabId,
  profile,
  className,
}: TerminalInstanceProps) {
  void profile;
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const resizeHandlerRef = useRef<(() => void) | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);

  const createSession = trpc.terminal.createSession.useMutation();
  const write = trpc.terminal.write.useMutation();
  const resize = trpc.terminal.resize.useMutation();

  const mutationsRef = useRef({ createSession, write, resize });
  mutationsRef.current = { createSession, write, resize };

  // Subscribe to terminal events
  trpc.terminal.events.useSubscription(
    { sessionId: sessionId ?? "" },
    {
      enabled: !!sessionId,
      onData(data: string) {
        terminalRef.current?.write(data);
      },
      onError(err) {
        toast.error(`Terminal connection error: ${err.message}`);
      },
    }
  );

  // Initialize XTerm.js terminal
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (terminalRef.current) {
      return;
    }

    let term: Terminal;
    let fitAddon: FitAddon;

    const initTerminal = async () => {
      const { Terminal } = await import("xterm");
      const { FitAddon } = await import("xterm-addon-fit");
      const { WebLinksAddon } = await import("xterm-addon-web-links");

      // ALFRED void theme
      term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: "Menlo, Monaco, 'Courier New', monospace",
        theme: {
          background: "#09090b", // void background
          foreground: "#fafafa", // biolum foreground
          selectionBackground: "#27272a",
          cursor: "#fafafa",
          black: "#09090b",
          red: "#ef4444",
          green: "#22c55e",
          yellow: "#eab308",
          blue: "#3b82f6",
          magenta: "#a855f7",
          cyan: "#06b6d4",
          white: "#fafafa",
          brightBlack: "#27272a",
          brightRed: "#f87171",
          brightGreen: "#4ade80",
          brightYellow: "#fbbf24",
          brightBlue: "#60a5fa",
          brightMagenta: "#c084fc",
          brightCyan: "#22d3ee",
          brightWhite: "#ffffff",
        },
        allowProposedApi: true,
      });

      fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);

      const container = containerRef.current;
      if (!container) {
        return;
      }

      term.open(container);
      fitAddon.fit();

      terminalRef.current = term;
      fitAddonRef.current = fitAddon;

      // Create terminal session
      mutationsRef.current.createSession.mutate(
        { cols: term.cols, rows: term.rows },
        {
          onSuccess: ({ sessionId: newSessionId }: { sessionId: string }) => {
            setSessionId(newSessionId);
            sessionIdRef.current = newSessionId;
          },
          onError: (err) => {
            toast.error(`Failed to create terminal session: ${err.message}`);
            term.write(
              "\r\n\u001B[31mFailed to create terminal session.\u001B[0m\r\n"
            );
          },
        }
      );

      // Handle user input
      term.onData((data) => {
        if (sessionIdRef.current) {
          mutationsRef.current.write.mutate({
            sessionId: sessionIdRef.current,
            data,
          });
        }
      });

      // Handle resize
      const handleResize = () => {
        fitAddon?.fit();
        if (sessionIdRef.current && terminalRef.current) {
          mutationsRef.current.resize.mutate({
            sessionId: sessionIdRef.current,
            cols: terminalRef.current.cols,
            rows: terminalRef.current.rows,
          });
        }
      };

      resizeHandlerRef.current = handleResize;
      window.addEventListener("resize", handleResize);
    };

    initTerminal();

    return () => {
      if (resizeHandlerRef.current) {
        window.removeEventListener("resize", resizeHandlerRef.current);
        resizeHandlerRef.current = null;
      }
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
      fitAddonRef.current = null;
    };
  }, [tabId]);

  // Update sessionId ref when state changes
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-void",
        className
      )}
    >
      <div className="h-full w-full" ref={containerRef} />
    </div>
  );
}
