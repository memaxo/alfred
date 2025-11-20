import type { NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import { MindscapeNode } from "./mindscape-node";

export function TerminalNode({ id, selected }: NodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const createSession = trpc.terminal.createSession.useMutation();
  const write = trpc.terminal.write.useMutation();
  const resize = trpc.terminal.resize.useMutation();
  const kill = trpc.terminal.kill.useMutation();

  // Store mutations in refs - tRPC mutations are stable but refs make dependency tracking explicit
  const mutationsRef = useRef({ createSession, write, resize, kill });
  mutationsRef.current = { createSession, write, resize, kill };

  // Store sessionId in state to enable subscription hook
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Subscription
  trpc.terminal.events.useSubscription(
    { sessionId: sessionId ?? "" },
    {
      enabled: !!sessionId,
      onData(data: string) {
        terminalRef.current?.write(data);
      },
      onError(err: Error) {
        toast.error(`Terminal connection error: ${err.message}`);
      },
    }
  );

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      theme: {
        background: "#09090b", // zinc-950
        foreground: "#fafafa", // zinc-50
        selectionBackground: "#27272a", // zinc-800
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Create session - use ref to access latest mutation
    mutationsRef.current.createSession.mutate(
      { cols: term.cols, rows: term.rows },
      {
        onSuccess: ({ sessionId: newSessionId }: { sessionId: string }) => {
          setSessionId(newSessionId);
          sessionIdRef.current = newSessionId;
        },
        onError: (err: Error) => {
          toast.error(`Failed to create terminal session: ${err.message}`);
          term.write(
            "\r\n\x1b[31mFailed to create terminal session.\x1b[0m\r\n"
          );
        },
      }
    );

    // Handle input - use ref to access latest mutation and avoid closure issues
    term.onData((data) => {
      if (sessionIdRef.current) {
        mutationsRef.current.write.mutate({
          sessionId: sessionIdRef.current,
          data,
        });
      }
    });

    // Handle resize - use ref to access latest mutation
    const handleResize = () => {
      fitAddon.fit();
      if (sessionIdRef.current) {
        mutationsRef.current.resize.mutate({
          sessionId: sessionIdRef.current,
          cols: term.cols,
          rows: term.rows,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
      if (sessionIdRef.current) {
        mutationsRef.current.kill.mutate({
          sessionId: sessionIdRef.current,
        });
      }
    };
  }, []); // Empty deps - mutations accessed via ref, terminal initialized once

  // Keep ref in sync with state
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  return (
    <MindscapeNode
      className="w-[600px]"
      id={id}
      selected={selected}
      title="Terminal"
    >
      <div className="overflow-hidden rounded-b-md bg-zinc-950 p-2">
        <div className="h-[300px]" ref={containerRef} />
      </div>
    </MindscapeNode>
  );
}
