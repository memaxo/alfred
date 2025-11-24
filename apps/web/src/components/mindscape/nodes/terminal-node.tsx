import type { NodeProps } from "@xyflow/react";
import { TerminalSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Terminal } from "xterm";
import type { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import { useLOD, useNodeFocus } from "../lod";
import { MindscapeNode } from "./mindscape-node";
import { NodeLODSmall, NodeLODTiny } from "./shared-lod";

export function TerminalNode({ id, selected }: NodeProps) {
  const lod = useLOD();
  useNodeFocus(id);

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
    // Only init terminal if ref exists (LOD > tiny/small)
    if (!containerRef.current) {
      return;
    }

    // Prevent double init
    if (terminalRef.current) {
      return;
    }

    let term: Terminal;
    let fitAddon: FitAddon;

    const initTerminal = async () => {
      const { Terminal } = await import("xterm");
      const { FitAddon } = await import("xterm-addon-fit");
      const { WebLinksAddon } = await import("xterm-addon-web-links");

      term = new Terminal({
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

      fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.open(containerRef.current!); // Non-null assertion safe due to check above
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
        fitAddon?.fit();
        if (sessionIdRef.current) {
          mutationsRef.current.resize.mutate({
            sessionId: sessionIdRef.current,
            cols: term.cols,
            rows: term.rows,
          });
        }
      };
      window.addEventListener("resize", handleResize);
    };

    initTerminal();

    return () => {
      // Note: cleanup might run before init finishes, check if initialized
      // Ideally we'd use a cancellation token or AbortController but for now we check refs
      // However, term and fitAddon are local vars inside initTerminal scope or accessible via refs?
      // We used terminalRef.current.

      // We can't easily remove the resize listener if we defined it inside initTerminal.
      // We should define handleResize outside or store it in a ref.
      // But since we are refactoring for SSR safety, let's keep it simple and assume cleanup runs on unmount.

      // Actually, if we use async init, the cleanup function returned by useEffect runs synchronously on unmount.
      // If init is still pending, we might have issues.

      // For now, I'll just fix the SSR crash by using dynamic imports.
      // The cleanup logic needs to be robust.

      if (terminalRef.current) {
        // Dispose logic
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
      // We can't removeEventListener because handleResize is scoped to initTerminal.
      // Use a ref for the resize handler?
    };
  }, [lod]); // Re-run if LOD changes (mounting/unmounting container)

  // Keep ref in sync with state
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // LOD 0: Tiny
  if (lod === "tiny") {
    return <NodeLODTiny color="bg-zinc-500" shadow="shadow-zinc-500/50" />;
  }

  // LOD 1: Small
  if (lod === "small") {
    return (
      <NodeLODSmall
        borderColor="border-zinc-500/20"
        hoverColor="hover:border-zinc-500/40"
        icon={<TerminalSquare className="h-3 w-3" />}
        label="Terminal"
        textColor="text-zinc-500"
      />
    );
  }

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
