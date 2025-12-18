"use client";

import { useEffect, useRef, useState } from "react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import type { WaveformProps } from "./types";
import { Waveform } from "./visual";

export type MicrophoneWaveformProps = WaveformProps & {
  active?: boolean;
  processing?: boolean;
  fftSize?: number;
  smoothingTimeConstant?: number;
  sensitivity?: number;
  onError?: (error: Error) => void;
};

export const MicrophoneWaveform = ({
  active = false,
  processing = false,
  fftSize = 256,
  smoothingTimeConstant = 0.8,
  sensitivity = 1,
  onError,
  ...props
}: MicrophoneWaveformProps) => {
  const [data, setData] = useState<number[]>([]);
  const animationIdRef = useRef<number | null>(null);
  const processingAnimationRef = useRef<number | null>(null);
  const lastActiveDataRef = useRef<number[]>([]);
  const transitionProgressRef = useRef(0);

  const { analyserRef } = useAudioRecorder({
    active,
    fftSize,
    smoothingTimeConstant,
    enableAudioPlayback: false,
    onError,
  });

  useEffect(() => {
    if (processing && !active) {
      let time = 0;
      transitionProgressRef.current = 0;

      const animateProcessing = () => {
        time += 0.03;
        transitionProgressRef.current = Math.min(
          1,
          transitionProgressRef.current + 0.02
        );

        const processingData: number[] = [];
        const barCount = 45;

        for (let i = 0; i < barCount; i++) {
          const normalizedPosition = (i - barCount / 2) / (barCount / 2);
          const centerWeight = 1 - Math.abs(normalizedPosition) * 0.4;

          const wave1 = Math.sin(time * 1.5 + i * 0.15) * 0.25;
          const wave2 = Math.sin(time * 0.8 - i * 0.1) * 0.2;
          const wave3 = Math.cos(time * 2 + i * 0.05) * 0.15;
          const combinedWave = wave1 + wave2 + wave3;
          const processingValue = (0.2 + combinedWave) * centerWeight;

          let finalValue = processingValue;
          if (
            lastActiveDataRef.current.length > 0 &&
            transitionProgressRef.current < 1
          ) {
            const lastDataIndex = Math.floor(
              (i / barCount) * lastActiveDataRef.current.length
            );
            const lastValue = lastActiveDataRef.current[lastDataIndex] || 0;
            finalValue =
              lastValue * (1 - transitionProgressRef.current) +
              processingValue * transitionProgressRef.current;
          }

          processingData.push(Math.max(0.05, Math.min(1, finalValue)));
        }

        setData(processingData);
        processingAnimationRef.current =
          requestAnimationFrame(animateProcessing);
      };

      animateProcessing();

      return () => {
        if (processingAnimationRef.current) {
          cancelAnimationFrame(processingAnimationRef.current);
        }
      };
    }
    if (!(active || processing)) {
      if (data.length > 0) {
        let fadeProgress = 0;
        const fadeToIdle = () => {
          fadeProgress += 0.03;
          if (fadeProgress < 1) {
            const fadedData = data.map((value) => value * (1 - fadeProgress));
            setData(fadedData);
            requestAnimationFrame(fadeToIdle);
          } else {
            setData([]);
          }
        };
        fadeToIdle();
      }
      return;
    }
  }, [processing, active, data.length, data.map]); // Removed data dep to avoid loop

  useEffect(() => {
    if (!active) {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      return;
    }

    const dataArray = new Uint8Array(fftSize / 2); // frequencyBinCount is half fftSize

    const updateData = () => {
      if (!(analyserRef.current && active)) {
        return;
      }

      analyserRef.current.getByteFrequencyData(dataArray);

      const startFreq = Math.floor(dataArray.length * 0.05);
      const endFreq = Math.floor(dataArray.length * 0.4);
      const relevantData = dataArray.slice(startFreq, endFreq);

      const halfLength = Math.floor(relevantData.length / 2);
      const normalizedData: number[] = [];

      for (let i = halfLength - 1; i >= 0; i--) {
        const val = relevantData[i] ?? 0;
        const value = Math.min(1, (val / 255) * sensitivity);
        normalizedData.push(value);
      }

      for (let i = 0; i < halfLength; i++) {
        const val = relevantData[i] ?? 0;
        const value = Math.min(1, (val / 255) * sensitivity);
        normalizedData.push(value);
      }

      setData(normalizedData);
      lastActiveDataRef.current = normalizedData;

      animationIdRef.current = requestAnimationFrame(updateData);
    };

    updateData();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [active, fftSize, sensitivity, analyserRef]);

  return <Waveform data={data} {...props} />;
};
