import { useMemo } from "react";

import type { WaveformProps } from "./types";

import { Waveform } from "./visual";

export type StaticWaveformProps = WaveformProps & {
  bars?: number;
  seed?: number;
};

export const StaticWaveform = ({
  bars = 40,
  seed = 42,
  ...props
}: StaticWaveformProps) => {
  const data = useMemo(() => {
    const random = (seedValue: number) => {
      const x = Math.sin(seedValue) * 10_000;
      return x - Math.floor(x);
    };

    return Array.from({ length: bars }, (_, i) => 0.2 + random(seed + i) * 0.6);
  }, [bars, seed]);

  return <Waveform data={data} {...props} />;
};
