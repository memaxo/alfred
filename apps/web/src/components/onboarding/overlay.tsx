"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDesktopStore } from "@/store/desktop";
import { IntegrationsStep } from "./integrations-step";
import { PreferencesStep } from "./preferences-step";
import { TourStep } from "./tour-step";
import { VoiceStep } from "./voice-step";
import { WelcomeStep } from "./welcome-step";

const STEPS = [
  { id: "welcome", component: WelcomeStep, title: "Welcome" },
  { id: "voice", component: VoiceStep, title: "Voice Setup" },
  { id: "preferences", component: PreferencesStep, title: "Autonomy & Policy" },
  {
    id: "integrations",
    component: IntegrationsStep,
    title: "Connect Services",
  },
  { id: "tour", component: TourStep, title: "Quick Tour" },
];

export function OnboardingOverlay() {
  const onboardingCompleted = useDesktopStore((s) => s.onboardingCompleted);
  const setOnboardingCompleted = useDesktopStore(
    (s) => s.setOnboardingCompleted
  );
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  if (onboardingCompleted) {
    return null;
  }

  const step = STEPS[currentStepIdx];
  const isLast = currentStepIdx === STEPS.length - 1;
  const isFirst = currentStepIdx === 0;

  const handleNext = () => {
    if (isLast) {
      setOnboardingCompleted(true);
    } else {
      setCurrentStepIdx((p) => p + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStepIdx((p) => p - 1);
    }
  };

  const StepComponent = step.component;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-void/80 backdrop-blur-md">
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative flex h-[600px] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-void-surface shadow-2xl"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-white/5 border-b bg-white/5 px-8">
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {STEPS.map((_, idx) => (
                <div
                  className={`h-1.5 w-8 rounded-full transition-colors ${
                    idx <= currentStepIdx ? "bg-biolum" : "bg-white/10"
                  }`}
                  key={_.id}
                />
              ))}
            </div>
            <span className="font-medium text-biolum text-sm uppercase tracking-widest opacity-60">
              Step {currentStepIdx + 1} of {STEPS.length}
            </span>
          </div>
          <button
            className="text-biolum-dim text-sm hover:text-biolum"
            onClick={() => setOnboardingCompleted(true)}
            type="button"
          >
            Skip for now
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              initial={{ opacity: 0, x: 20 }}
              key={step.id}
              transition={{ duration: 0.2 }}
            >
              <StepComponent />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex h-20 items-center justify-between border-white/5 border-t bg-white/5 px-8">
          <Button
            className="gap-2"
            disabled={isFirst}
            onClick={handlePrev}
            variant="ghost"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button className="min-w-[120px] gap-2" onClick={handleNext}>
            {isLast ? (
              <>
                Finish
                <Check className="h-4 w-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
