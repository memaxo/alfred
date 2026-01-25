import { Check, ChevronRight, Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";

export interface Step {
  id: string;
  title: string;
  description?: string;
  content: React.ReactNode;
}

export interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepChange?: (stepIndex: number) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onComplete?: () => void;
  isLoading?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Stepper({
  steps,
  currentStep,
  onStepChange,
  onNext,
  onPrevious,
  onComplete,
  isLoading = false,
  className,
  size = "md",
}: StepperProps) {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const sizeClasses = {
    sm: "text-sm gap-1",
    md: "text-base gap-2",
    lg: "text-lg gap-3",
  };

  const iconSize = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const pillSize = {
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm",
    lg: "h-10 w-10 text-base",
  };

  const handleNext = () => {
    if (isLastStep) {
      onComplete?.();
    } else {
      onNext?.();
    }
  };

  const handleStepClick = (index: number) => {
    if (!isLoading && index <= currentStep) {
      onStepChange?.(index);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-8 flex items-center justify-start">
        <nav className="flex items-center">
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            const isClickable = index <= currentStep;

            return (
              <React.Fragment key={step.id}>
                <button
                  className={cn(
                    "flex items-center transition-all",
                    sizeClasses[size],
                    isClickable
                      ? "cursor-pointer"
                      : "cursor-not-allowed opacity-50"
                  )}
                  disabled={!isClickable || isLoading}
                  onClick={() => handleStepClick(index)}
                  type="button"
                >
                  <div
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded-full border font-medium transition-colors",
                      pillSize[size],
                      isActive
                        ? "border-biolum bg-biolum/10 text-biolum"
                        : (isCompleted
                          ? "border-biolum bg-biolum text-background"
                          : "border-white/20 bg-void-surface/50 text-biolum-dim")
                    )}
                  >
                    {isCompleted ? (
                      <Check className={iconSize[size]} />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className="flex flex-col items-start">
                    <span
                      className={cn(
                        "font-medium",
                        isActive ? "text-biolum" : "text-biolum-dim"
                      )}
                    >
                      {step.title}
                    </span>
                    {step.description && size !== "sm" && (
                      <span className="text-biolum-faint text-xs">
                        {step.description}
                      </span>
                    )}
                  </div>
                </button>
                {index < steps.length - 1 && (
                  <ChevronRight
                    className={cn("shrink-0 text-biolum-faint", iconSize[size])}
                  />
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      <div className="flex-1">{steps[currentStep]?.content}</div>

      <div className="mt-8 flex items-center justify-end gap-2 border-white/10 border-t pt-4">
        <Button
          disabled={isFirstStep || isLoading}
          onClick={onPrevious}
          variant="outline"
        >
          Previous
        </Button>
        <Button
          className="min-w-[120px]"
          disabled={isLoading}
          onClick={handleNext}
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isLastStep ? "Complete" : "Next"}
        </Button>
      </div>
    </div>
  );
}

export type WizardProps = Omit<StepperProps, "steps"> & {
  children: React.ReactNode;
};

export function Wizard({ children, ...stepperProps }: WizardProps) {
  const steps = React.useMemo(() => {
    const stepsArray: Step[] = [];
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.type === WizardStep) {
        const props = child.props as WizardStepProps;
        stepsArray.push({
          id: props.id,
          title: props.title,
          description: props.description,
          content: props.children as React.ReactNode,
        });
      }
    });
    return stepsArray;
  }, [children]);

  return <Stepper {...stepperProps} steps={steps} />;
}

export interface WizardStepProps {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function WizardStep({ children }: WizardStepProps) {
  return <>{children}</>;
}
