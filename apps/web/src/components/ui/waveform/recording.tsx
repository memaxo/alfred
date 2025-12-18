"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { WaveformProps } from "./types";

export type RecordingWaveformProps = Omit<
  WaveformProps,
  "data" | "onBarClick"
> & {
  recording?: boolean;
  fftSize?: number;
  smoothingTimeConstant?: number;
  sensitivity?: number;
  onError?: (error: Error) => void;
  onRecordingComplete?: (data: number[]) => void;
  updateRate?: number;
  showHandle?: boolean;
};

export const RecordingWaveform = ({
  recording = false,
  fftSize = 256,
  smoothingTimeConstant = 0.8,
  sensitivity = 1,
  onError,
  onRecordingComplete,
  updateRate = 50,
  showHandle = true,
  barWidth = 3,
  barHeight: baseBarHeight = 4,
  barGap = 1,
  barRadius = 1,
  barColor,
  height = 128,
  className,
  ...props
}: RecordingWaveformProps) => {
  const [recordedData, setRecordedData] = useState<number[]>([]);
  const [viewPosition, setViewPosition] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecordingComplete, setIsRecordingComplete] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const recordingDataRef = useRef<number[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);

  const heightStyle = typeof height === "number" ? `${height}px` : height;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!(canvas && container)) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!recording) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }

      if (recordingDataRef.current.length > 0) {
        setRecordedData([...recordingDataRef.current]);
        setIsRecordingComplete(true);
        onRecordingComplete?.(recordingDataRef.current);
      }
      return;
    }

    setIsRecordingComplete(false);
    recordingDataRef.current = [];
    setRecordedData([]);
    setViewPosition(1);

    const setupMicrophone = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        streamRef.current = stream;

        const AudioContextClass =
          window.AudioContext ||
          (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
        const audioContext = new AudioContextClass();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = smoothingTimeConstant;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
      } catch (error) {
        onError?.(error as Error);
      }
    };

    setupMicrophone();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }
    };
  }, [recording, fftSize, smoothingTimeConstant, onError, onRecordingComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const animate = (currentTime: number) => {
      if (recording && currentTime - lastUpdateRef.current > updateRate) {
        lastUpdateRef.current = currentTime;

        if (analyserRef.current) {
          const dataArray = new Uint8Array(
            analyserRef.current.frequencyBinCount
          );
          analyserRef.current.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] ?? 0;
          }
          const average = (sum / dataArray.length / 255) * sensitivity;

          recordingDataRef.current.push(Math.min(1, Math.max(0.05, average)));
        }
      }

      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const computedBarColor =
        barColor ||
        getComputedStyle(canvas).getPropertyValue("--foreground") ||
        "#000";

      const dataToRender = recording ? recordingDataRef.current : recordedData;

      if (dataToRender.length > 0) {
        const step = barWidth + barGap;
        const barsVisible = Math.floor(rect.width / step);
        const centerY = rect.height / 2;

        let startIndex = 0;
        if (!recording && isRecordingComplete) {
          const totalBars = dataToRender.length;
          if (totalBars > barsVisible) {
            startIndex = Math.floor((totalBars - barsVisible) * viewPosition);
          }
        } else if (recording) {
          startIndex = Math.max(0, dataToRender.length - barsVisible);
        }

        for (
          let i = 0;
          i < barsVisible && startIndex + i < dataToRender.length;
          i++
        ) {
          const value = dataToRender[startIndex + i] || 0.1;
          const x = i * step;
          const barHeight = Math.max(baseBarHeight, value * rect.height * 0.7);
          const y = centerY - barHeight / 2;

          ctx.fillStyle = computedBarColor;
          ctx.globalAlpha = 0.3 + value * 0.7;

          if (barRadius > 0) {
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, barRadius);
            ctx.fill();
          } else {
            ctx.fillRect(x, y, barWidth, barHeight);
          }
        }

        if (!recording && isRecordingComplete && showHandle) {
          const indicatorX = rect.width * viewPosition;

          ctx.strokeStyle = computedBarColor;
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(indicatorX, 0);
          ctx.lineTo(indicatorX, rect.height);
          ctx.stroke();
          ctx.fillStyle = computedBarColor;
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(indicatorX, centerY, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    recording,
    recordedData,
    viewPosition,
    isRecordingComplete,
    sensitivity,
    updateRate,
    showHandle,
    barWidth,
    baseBarHeight,
    barGap,
    barRadius,
    barColor,
  ]);

  const handleScrub = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container || recording || !isRecordingComplete) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const position = x / rect.width;

      setViewPosition(position);
    },
    [recording, isRecordingComplete]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (recording || !isRecordingComplete) {
      return;
    }

    e.preventDefault();
    setIsDragging(true);
    handleScrub(e.clientX);
  };

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      handleScrub(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleScrub]);

  return (
    <div
      aria-label={
        isRecordingComplete && !recording
          ? "Drag to scrub through recording"
          : undefined
      }
      aria-valuemax={isRecordingComplete && !recording ? 100 : undefined}
      aria-valuemin={isRecordingComplete && !recording ? 0 : undefined}
      aria-valuenow={
        isRecordingComplete && !recording ? viewPosition * 100 : undefined
      }
      className={cn(
        "relative flex items-center",
        isRecordingComplete && !recording && "cursor-pointer",
        className
      )}
      onMouseDown={handleMouseDown}
      ref={containerRef}
      role={isRecordingComplete && !recording ? "slider" : undefined}
      style={{ height: heightStyle }}
      tabIndex={isRecordingComplete && !recording ? 0 : undefined}
      {...props}
    >
      <canvas className="block h-full w-full" ref={canvasRef} />
    </div>
  );
};
