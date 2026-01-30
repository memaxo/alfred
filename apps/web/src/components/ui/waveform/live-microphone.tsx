import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import type { ScrollingWaveformProps } from "./scrolling";

export type LiveMicrophoneWaveformProps = Omit<
  ScrollingWaveformProps,
  "barCount"
> & {
  active?: boolean;
  fftSize?: number;
  smoothingTimeConstant?: number;
  sensitivity?: number;
  onError?: (error: Error) => void;
  historySize?: number;
  updateRate?: number;
  savedHistoryRef?: React.MutableRefObject<number[]>;
  dragOffset?: number;
  setDragOffset?: (offset: number) => void;
  enableAudioPlayback?: boolean;
  playbackRate?: number;
};

export const LiveMicrophoneWaveform = ({
  active = false,
  fftSize = 256,
  smoothingTimeConstant = 0.8,
  sensitivity = 1,
  onError,
  historySize = 150,
  updateRate = 50,
  barWidth = 3,
  barHeight: baseBarHeight = 4,
  barGap = 1,
  barRadius = 1,
  barColor,
  fadeEdges = true,
  fadeWidth = 24,
  height = 128,
  className,
  savedHistoryRef,
  dragOffset: externalDragOffset,
  setDragOffset: externalSetDragOffset,
  enableAudioPlayback = true,
  playbackRate = 1,
  ...props
}: LiveMicrophoneWaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const internalHistoryRef = useRef<number[]>([]);
  const historyRef = savedHistoryRef || internalHistoryRef;
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const [internalDragOffset, setInternalDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState<number | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragStartOffsetRef = useRef<number>(0);
  const playbackStartTimeRef = useRef<number>(0);

  // Audio recording and playback refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const scrubSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Use external drag state if provided, otherwise use internal
  const dragOffset = externalDragOffset ?? internalDragOffset;
  const setDragOffset = externalSetDragOffset ?? setInternalDragOffset;

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

  const processAudioBlob = useCallback(async (blob: Blob) => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      if (audioContextRef.current) {
        const audioBuffer =
          await audioContextRef.current.decodeAudioData(arrayBuffer);
        audioBufferRef.current = audioBuffer;
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!active) {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      // Process recorded audio when stopping
      if (enableAudioPlayback && audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        processAudioBlob(audioBlob);
      }
      return;
    }

    setDragOffset?.(0);
    historyRef.current = [];
    audioChunksRef.current = [];
    audioBufferRef.current = null;
    setPlaybackPosition(null);

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

        if (enableAudioPlayback) {
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };

          mediaRecorder.start(100);
        }
      } catch (error) {
        onError?.(error as Error);
      }
    };

    setupMicrophone();

    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }
      if (scrubSourceRef.current) {
        scrubSourceRef.current.stop();
      }
    };
  }, [
    active,
    fftSize,
    smoothingTimeConstant,
    onError,
    setDragOffset,
    enableAudioPlayback,
    historyRef,
    processAudioBlob,
  ]);

  const playScrubSound = useCallback(
    (position: number, direction: number) => {
      if (
        !(
          enableAudioPlayback &&
          audioBufferRef.current &&
          audioContextRef.current
        )
      ) {
        return;
      }

      if (scrubSourceRef.current) {
        try {
          scrubSourceRef.current.stop();
        } catch {}
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current;

      const speed = Math.abs(direction);
      const playbackRate =
        direction > 0
          ? Math.min(3, 1 + speed * 0.1)
          : Math.max(-3, -1 - speed * 0.1);

      source.playbackRate.value = playbackRate;

      const filter = audioContextRef.current.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = Math.max(200, 2000 - speed * 100);

      source.connect(filter);
      filter.connect(audioContextRef.current.destination);

      const startTime = Math.max(
        0,
        Math.min(position, audioBufferRef.current.duration - 0.1)
      );
      source.start(0, startTime, 0.1);
      scrubSourceRef.current = source;
    },
    [enableAudioPlayback]
  );

  const playFromPosition = useCallback(
    (position: number) => {
      if (
        !(
          enableAudioPlayback &&
          audioBufferRef.current &&
          audioContextRef.current
        )
      ) {
        return;
      }

      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
        } catch {}
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.playbackRate.value = playbackRate;
      source.connect(audioContextRef.current.destination);

      const startTime = Math.max(
        0,
        Math.min(position, audioBufferRef.current.duration)
      );
      source.start(0, startTime);
      sourceNodeRef.current = source;

      playbackStartTimeRef.current =
        audioContextRef.current.currentTime - startTime;
      setPlaybackPosition(startTime);

      source.onended = () => {
        setPlaybackPosition(null);
      };
    },
    [enableAudioPlayback, playbackRate]
  );

  useEffect(() => {
    if (playbackPosition === null || !audioBufferRef.current) {
      return;
    }

    let animationId: number;
    const updatePlaybackVisual = () => {
      if (
        audioContextRef.current &&
        sourceNodeRef.current &&
        audioBufferRef.current
      ) {
        const elapsed =
          audioContextRef.current.currentTime - playbackStartTimeRef.current;
        const currentPos = playbackPosition + elapsed * playbackRate;

        if (currentPos < audioBufferRef.current.duration) {
          const progressRatio = currentPos / audioBufferRef.current.duration;
          const currentBarIndex = Math.floor(
            progressRatio * historyRef.current.length
          );
          const step = barWidth + barGap;

          const containerWidth =
            containerRef.current?.getBoundingClientRect().width || 0;
          const viewBars = Math.floor(containerWidth / step);
          const targetOffset =
            -(currentBarIndex - (historyRef.current.length - viewBars)) * step;
          const clampedOffset = Math.max(
            -(historyRef.current.length - viewBars) * step,
            Math.min(0, targetOffset)
          );

          setDragOffset?.(clampedOffset);
          animationId = requestAnimationFrame(updatePlaybackVisual);
        } else {
          setPlaybackPosition(null);
          const step = barWidth + barGap;
          const containerWidth =
            containerRef.current?.getBoundingClientRect().width || 0;
          const viewBars = Math.floor(containerWidth / step);
          setDragOffset?.(-(historyRef.current.length - viewBars) * step);
        }
      }
    };

    animationId = requestAnimationFrame(updatePlaybackVisual);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [
    playbackPosition,
    playbackRate,
    barWidth,
    barGap,
    setDragOffset,
    historyRef,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    if (
      !active &&
      historyRef.current.length === 0 &&
      playbackPosition === null
    ) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const animate = (currentTime: number) => {
      if (active && currentTime - lastUpdateRef.current > updateRate) {
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

          historyRef.current.push(Math.min(1, Math.max(0.05, average)));

          if (historyRef.current.length > historySize) {
            historyRef.current.shift();
          }
        }
      }

      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const computedBarColor =
        barColor ||
        getComputedStyle(canvas).getPropertyValue("--foreground") ||
        "#000";

      const step = barWidth + barGap;
      const barCount = Math.floor(rect.width / step);
      const centerY = rect.height / 2;

      const dataToRender = historyRef.current;

      if (dataToRender.length > 0) {
        const offsetInBars = Math.floor(dragOffset / step);

        for (let i = 0; i < barCount; i++) {
          let dataIndex: number;

          if (active) {
            dataIndex = dataToRender.length - 1 - i;
          } else {
            dataIndex = Math.max(
              0,
              Math.min(
                dataToRender.length - 1,
                dataToRender.length - 1 - i - Math.floor(offsetInBars)
              )
            );
          }

          if (dataIndex >= 0 && dataIndex < dataToRender.length) {
            const value = dataToRender[dataIndex];
            if (value !== undefined) {
              const x = rect.width - (i + 1) * step;
              const barHeight = Math.max(
                baseBarHeight,
                value * rect.height * 0.7
              );
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
          }
        }
      }

      if (fadeEdges && fadeWidth > 0) {
        const gradient = ctx.createLinearGradient(0, 0, rect.width, 0);
        const fadePercent = Math.min(0.2, fadeWidth / rect.width);

        gradient.addColorStop(0, "rgba(255,255,255,1)");
        gradient.addColorStop(fadePercent, "rgba(255,255,255,0)");
        gradient.addColorStop(1 - fadePercent, "rgba(255,255,255,0)");
        gradient.addColorStop(1, "rgba(255,255,255,1)");

        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.globalCompositeOperation = "source-over";
      }

      ctx.globalAlpha = 1;

      animationRef.current = requestAnimationFrame(animate);
    };

    if (active || historyRef.current.length > 0 || playbackPosition !== null) {
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    active,
    sensitivity,
    updateRate,
    historySize,
    barWidth,
    baseBarHeight,
    barGap,
    barRadius,
    barColor,
    fadeEdges,
    fadeWidth,
    dragOffset,
    playbackPosition,
    historyRef,
  ]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (active || historyRef.current.length === 0) {
      return;
    }

    e.preventDefault();
    setIsDragging(true);
    dragStartXRef.current = e.clientX;
    dragStartOffsetRef.current = dragOffset;
  };

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    let lastScrubTime = 0;
    let lastMouseX = dragStartXRef.current;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartXRef.current;
      const newOffset = dragStartOffsetRef.current - deltaX * 0.5; // Reduce sensitivity

      const step = barWidth + barGap;
      const maxBars = historyRef.current.length;
      const viewWidth = canvasRef.current?.getBoundingClientRect().width || 0;
      const viewBars = Math.floor(viewWidth / step);

      const maxOffset = Math.max(0, (maxBars - viewBars) * step);
      const minOffset = 0;
      const clampedOffset = Math.max(minOffset, Math.min(maxOffset, newOffset));

      setDragOffset?.(clampedOffset);

      const now = Date.now();
      if (
        enableAudioPlayback &&
        audioBufferRef.current &&
        now - lastScrubTime > 50
      ) {
        lastScrubTime = now;
        const offsetBars = Math.floor(clampedOffset / step);
        const rightmostBarIndex = Math.max(
          0,
          Math.min(maxBars - 1, maxBars - 1 - offsetBars)
        );
        const audioPosition =
          (rightmostBarIndex / maxBars) * audioBufferRef.current.duration;
        const direction = e.clientX - lastMouseX;
        lastMouseX = e.clientX;
        playScrubSound(
          Math.max(
            0,
            Math.min(audioBufferRef.current.duration - 0.1, audioPosition)
          ),
          direction
        );
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);

      if (enableAudioPlayback && audioBufferRef.current) {
        const step = barWidth + barGap;
        const maxBars = historyRef.current.length;
        const offsetBars = Math.floor(dragOffset / step);
        const rightmostBarIndex = Math.max(
          0,
          Math.min(maxBars - 1, maxBars - 1 - offsetBars)
        );
        const audioPosition =
          (rightmostBarIndex / maxBars) * audioBufferRef.current.duration;
        playFromPosition(
          Math.max(
            0,
            Math.min(audioBufferRef.current.duration - 0.1, audioPosition)
          )
        );
      }

      if (scrubSourceRef.current) {
        try {
          scrubSourceRef.current.stop();
        } catch {}
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDragging,
    barWidth,
    barGap,
    setDragOffset,
    dragOffset,
    enableAudioPlayback,
    playScrubSound,
    playFromPosition,
    historyRef,
  ]);

  return (
    <div
      aria-label={
        !active && historyRef.current.length > 0
          ? "Drag to scrub through recording"
          : undefined
      }
      aria-valuemax={
        !active && historyRef.current.length > 0
          ? historyRef.current.length
          : undefined
      }
      aria-valuemin={!active && historyRef.current.length > 0 ? 0 : undefined}
      aria-valuenow={
        !active && historyRef.current.length > 0
          ? Math.abs(dragOffset)
          : undefined
      }
      className={cn(
        "relative flex items-center",
        !active && historyRef.current.length > 0 && "cursor-pointer",
        className
      )}
      onMouseDown={handleMouseDown}
      ref={containerRef}
      role={!active && historyRef.current.length > 0 ? "slider" : undefined}
      style={{ height: heightStyle }}
      tabIndex={!active && historyRef.current.length > 0 ? 0 : undefined}
      {...props}
    >
      <canvas className="block h-full w-full" ref={canvasRef} />
    </div>
  );
};
