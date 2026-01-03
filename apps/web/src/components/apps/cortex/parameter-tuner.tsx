"use client";

/**
 * Parameter Tuner - Real-time shader parameter sliders
 */

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CortexPreset } from "./index";

type ParameterTunerProps = {
  preset: CortexPreset | null;
};

const defaultParameters = [
  {
    name: "intensity",
    label: "Intensity",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.5,
  },
  {
    name: "frequency",
    label: "Frequency",
    min: 0.1,
    max: 10,
    step: 0.1,
    default: 2,
  },
  {
    name: "amplitude",
    label: "Amplitude",
    min: 0,
    max: 2,
    step: 0.01,
    default: 1,
  },
  { name: "speed", label: "Speed", min: 0, max: 5, step: 0.1, default: 1 },
  {
    name: "colorShift",
    label: "Color Shift",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0,
  },
];

export function ParameterTuner({ preset }: ParameterTunerProps) {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(
      defaultParameters.map((p) => [
        p.name,
        preset?.parameters[p.name] ?? p.default,
      ])
    )
  );

  const handleChange = (name: string, value: number) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    setValues(
      Object.fromEntries(defaultParameters.map((p) => [p.name, p.default]))
    );
  };

  if (!preset) {
    return (
      <div className="p-4 text-center text-biolum-dim text-sm">
        Select a preset to tune parameters
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium text-sm">Parameters</span>
        <Button className="h-6" onClick={handleReset} size="sm" variant="ghost">
          <RotateCcw className="mr-1 h-3 w-3" />
          Reset
        </Button>
      </div>

      <div className="space-y-4">
        {defaultParameters.map((param) => (
          <div key={param.name}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-biolum-dim">{param.label}</span>
              <span className="font-mono">
                {values[param.name]?.toFixed(2)}
              </span>
            </div>
            <input
              className="w-full accent-biolum"
              max={param.max}
              min={param.min}
              onChange={(e) =>
                handleChange(param.name, Number.parseFloat(e.target.value))
              }
              step={param.step}
              type="range"
              value={values[param.name] ?? param.default}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
