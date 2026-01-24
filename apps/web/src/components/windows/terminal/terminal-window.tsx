import type { NodeProps } from "@xyflow/react";
import type { Terminal } from "xterm";
import type { FitAddon } from "xterm-addon-fit";

import { TerminalSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "xterm/css/xterm.css";
import { toast } from "sonner";

import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";
import { trpc } from "@/utils/trpc";

export function TerminalWindow({ id, selected }: NodeProps) {
  const lod = useLOD();

  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const resizeHandlerRef = useRef<(() => void) | null>(null);

  const createSession = trpc.terminal.createSession.useMutation();
  const write = trpc.terminal.write.useMutation();
  const resize = trpc.terminal.resize.useMutation();

  const mutationsRef = useRef({ createSession, write, resize });
  mutationsRef.current = { createSession, write, resize };

  const [sessionId, setSessionId] = useState<string | null>(null);

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

      term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: "Menlo, Monaco, 'Courier New', monospace",
        theme: {
          background: "#09090b",
          foreground: "#fafafa",
          selectionBackground: "#27272a",
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
              "\r\n\x1b[31mFailed to create terminal session.\x1b[0m\r\n"
            );
          },
        }
      );

      term.onData((data) => {
        if (sessionIdRef.current) {
          mutationsRef.current.write.mutate({
            sessionId: sessionIdRef.current,
            data,
          });
        }
      });

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
    };
  }, [lod]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  if (lod === "tiny") {
    return <TinyDot color="bg-zinc-500" shadow="shadow-zinc-500/50" />;
  }

  if (lod === "small") {
    return (
      <SmallCard
        borderColor="border-zinc-500/20"
        hoverColor="hover:border-zinc-500/40"
        icon={<TerminalSquare className="h-3 w-3" />}
        label="Terminal"
        textColor="text-zinc-500"
      />
    );
  }

  return (
    <WindowFrame
      id={id}
      selected={selected}
      title="Terminal"
      width={600}
      windowType="terminal"
    >
      <div className="overflow-hidden rounded-b-md bg-zinc-950 p-2">
        <div className="h-[300px]" ref={containerRef} />
      </div>
    </WindowFrame>
  );
}
