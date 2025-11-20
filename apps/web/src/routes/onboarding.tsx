import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { RouteError } from "@/components/route-error";
import { WelcomeStep } from "@/components/onboarding/welcome-step";
import { PreferencesStep } from "@/components/onboarding/preferences-step";
import { IntegrationsStep } from "@/components/onboarding/integrations-step";
import { TourStep } from "@/components/onboarding/tour-step";
import type { AutonomyLevel } from "@/components/autonomy-slider";
import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingRoute,
  errorComponent: RouteError,
});

const TOTAL_STEPS = 4;

function OnboardingRoute() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [autonomy, setAutonomy] = useState<AutonomyLevel>("low");

  const setPreference = trpc.preference.set.useMutation();

  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleComplete = useCallback(async () => {
    try {
      // Save autonomy preference
      await setPreference.mutateAsync({
        key: "autonomy",
        value: autonomy,
        confidence: 1,
      });

      // Mark onboarding as complete
      await setPreference.mutateAsync({
        key: "onboarding_complete",
        value: true,
        confidence: 1,
      });

      toast.success("Welcome to ALFRED!");
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error("Failed to complete onboarding. Please try again.");
    }
  }, [autonomy, navigate, setPreference]);

  const handleSkipIntegrations = useCallback(() => {
    handleNext();
  }, [handleNext]);

  const progress = (currentStep / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-6">
      <div className="w-full max-w-3xl space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-biolum-dim">Step {currentStep} of {TOTAL_STEPS}</span>
            <span className="text-biolum-dim">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 rounded-full bg-void-surface/40 overflow-hidden">
            <div
              className="h-full bg-biolum transition-all duration-300"
              style={{ width: `${progress}%`, boxShadow: "0 0 10px oklch(0.99 0 0 / 0.4)" }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl p-8">
          {currentStep === 1 && <WelcomeStep />}
          {currentStep === 2 && (
            <PreferencesStep autonomy={autonomy} onAutonomyChange={setAutonomy} />
          )}
          {currentStep === 3 && <IntegrationsStep onSkip={handleSkipIntegrations} />}
          {currentStep === 4 && <TourStep onComplete={handleComplete} />}
        </div>

        {/* Navigation */}
        {currentStep < TOTAL_STEPS && (
          <div className="flex justify-between">
            <Button
              onClick={handlePrev}
              variant="outline"
              className="rounded-full"
              disabled={currentStep === 1}
            >
              Previous
            </Button>
            <Button
              onClick={currentStep === 3 ? handleSkipIntegrations : handleNext}
              className="rounded-full"
            >
              {currentStep === 3 ? "Skip" : "Next"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

