import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Fingerprint } from "lucide-react";
import { useState } from "react";
import { RouteError } from "@/components/route-error";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: RouteComponent,
  errorComponent: RouteError,
});

function RouteComponent() {
  const [showSignIn, setShowSignIn] = useState(true);
  const [isLocked, setIsLocked] = useState(true);

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-[oklch(0.05_0_0)] text-[oklch(0.99_0_0)]">
      <AnimatePresence mode="wait">
        {isLocked ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="flex cursor-pointer flex-col items-center justify-center gap-8"
            exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
            initial={{ opacity: 0 }}
            key="lock"
            onClick={() => setIsLocked(false)}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          >
            <div className="group relative">
              <motion.div
                animate={{ opacity: [0.1, 0.3, 0.1], scale: [0.8, 1.2, 0.8] }}
                className="absolute inset-0 rounded-full bg-[oklch(0.99_0_0)] blur-2xl"
                transition={{
                  duration: 4,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
              />
              <Fingerprint
                className="relative z-10 h-16 w-16 text-[oklch(0.99_0_0)] transition-transform duration-500 group-hover:scale-105"
                strokeWidth={1}
              />
            </div>
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              className="font-mono text-xs uppercase tracking-[0.3em] opacity-40"
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
            >
              Touch to Decrypt
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            className="w-full max-w-md px-4"
            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
            key="form"
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* HUD / Glass Container */}
            <div className="relative overflow-hidden rounded-3xl border border-[oklch(0.99_0_0)]/10 bg-[oklch(0.14_0_0)]/40 backdrop-blur-2xl">
              {/* Scanline / Shine effect */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-[oklch(0.99_0_0)]/5 to-transparent" />

              <div className="relative z-10">
                {showSignIn ? (
                  <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
                ) : (
                  <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
