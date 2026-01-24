import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

import { ClientOnly } from "@/components/ai-elements/client-only";
import { AlfredDesktopShell } from "@/components/desktop/shell";
// Intro / Presence
import { Orb } from "@/components/ui/orb";
import {
  type DesktopSearchParams,
  useDesktopDeeplinks,
} from "@/hooks/use-desktop-deeplinks";
import { useKnowledgeVisualize } from "@/hooks/use-knowledge-visualize";
import { useVoiceSessionWeb } from "@/hooks/use-voice-session-web";
import { useDesktopStore } from "@/store/desktop";

const searchSchema = z.object({
  windowId: z.string().optional(),
  spawn: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  ragDoc: z.string().optional(),
});

export const Route = createFileRoute("/_protected/")({
  ssr: false, // Uses ReactFlow - browser-only
  component: DesktopRoute,
  validateSearch: (search) => searchSchema.parse(search),
});

function DesktopRoute() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_protected/" }) as DesktopSearchParams;
  const { visualizeFromWindow } = useKnowledgeVisualize();
  const spawnWindow = useDesktopStore((s) => s.spawnWindow);
  const focusWindow = useDesktopStore((s) => s.focusWindow);

  const isTestMode =
    import.meta.env.VITE_TEST_MODE === "true" ||
    import.meta.env.MINDSCAPE_TEST === "1";

  // Intro State
  const [introMode, setIntroMode] = useState<"intro" | "active">(
    isTestMode ? "active" : "intro"
  );
  const { stream } = useVoiceSessionWeb();

  // Process deep link params
  useDesktopDeeplinks(search);

  // Auto-activate voice in intro mode
  useEffect(() => {
    if (isTestMode) {
      return;
    }
    if (introMode !== "intro") {
      return;
    }
    if (stream.status === "idle") {
      stream.start().catch(() => {
        // Silent catch - browser autoplay policy might block
      });
    }
  }, [introMode, isTestMode, stream.start, stream.status]);

  // Interaction dismissal
  useEffect(() => {
    if (isTestMode) {
      return;
    }
    if (introMode !== "intro") {
      return;
    }

    const dismiss = () => {
      setIntroMode("active");
    };

    const opts = { once: true };
    window.addEventListener("mousemove", dismiss, opts);
    window.addEventListener("keydown", dismiss, opts);
    window.addEventListener("click", dismiss, opts);
    window.addEventListener("touchstart", dismiss, opts);

    return () => {
      window.removeEventListener("mousemove", dismiss);
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("click", dismiss);
      window.removeEventListener("touchstart", dismiss);
    };
  }, [introMode, isTestMode]);

  const handleVisualize = async (windowId: string) => {
    await visualizeFromWindow(windowId);
  };

  const handleAsk = (_windowId: string, _label?: string) => {
    // Spawn or focus chat window and pre-fill with context
    const chatId = spawnWindow("chat");
    focusWindow(chatId);
  };

  const getInputVolume = useCallback(() => {
    if (!stream.analyser) {
      return 0;
    }
    const dataArray = new Uint8Array(stream.analyser.frequencyBinCount);
    stream.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] ?? 0;
    }
    const average = sum / dataArray.length;
    return average / 255;
  }, [stream.analyser]);

  // Map stream status to Orb agent state
  const getAgentState = () => {
    switch (stream.status) {
      case "recording":
        return "listening";
      case "processing":
        return "thinking";
      case "playing":
        return "talking";
      case "connecting":
        return "thinking";
      default:
        return "listening"; // Pulse in idle/listening state for "Presence"
    }
  };

  return (
    <ClientOnly>
      <div className="relative h-screen w-screen overflow-hidden bg-[oklch(0.05_0_0)] text-[oklch(0.99_0_0)]">
        {/* Desktop Shell */}
        <motion.div
          animate={{
            opacity: introMode === "active" ? 1 : 0,
            scale: introMode === "active" ? 1 : 0.98,
            filter: introMode === "active" ? "blur(0px)" : "blur(10px)",
          }}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 1.5, ease: [0.25, 0.4, 0.25, 1] }}
        >
          <AlfredDesktopShell
            onAsk={handleAsk}
            onVisualize={handleVisualize}
            onWorkflowNavigate={(runId) =>
              navigate({
                to: "/workflow/$runId",
                params: { runId },
                search: () => ({ drawer: "1" as const }),
              })
            }
          />
        </motion.div>

        {/* Intro Overlay */}
        <AnimatePresence>
          {introMode === "intro" && (
            <motion.div
              className="absolute inset-0 z-[9999] flex items-center justify-center bg-[oklch(0.05_0_0)]"
              exit={{ opacity: 0, scale: 1.1, filter: "blur(20px)" }}
              initial={{ opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
            >
              <div className="h-full w-full">
                <Orb
                  agentState={getAgentState()}
                  className="h-full w-full"
                  getInputVolume={getInputVolume}
                />
              </div>

              <motion.div
                animate={{ opacity: 1 }}
                className="absolute bottom-12 select-none font-mono text-[oklch(0.4_0_0)] text-sm uppercase tracking-widest"
                initial={{ opacity: 0 }}
                transition={{ delay: 2.0, duration: 1.5 }}
              >
                Signal in the Void
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ClientOnly>
  );
}
