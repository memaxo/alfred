import type { VoiceStreamClient } from "@alfred/voice/stream";

import { createClientOnlyFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { EnergyVAD } from "@/lib/voice/vad";

const getMediaStream = createClientOnlyFn((): Promise<MediaStream> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("media_devices_unavailable");
  }
  return navigator.mediaDevices.getUserMedia({ audio: true });
});

const getAudioContext = createClientOnlyFn(() => {
  if (typeof AudioContext === "undefined") {
    throw new TypeError("audio_context_unavailable");
  }
  return new AudioContext();
});

export function useVoiceAudio() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const vadRef = useRef<EnergyVAD | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const ensureContext = useCallback(async () => {
    let ctx = audioContextRef.current;
    if (!ctx) {
      ctx = getAudioContext();
      audioContextRef.current = ctx;
    }
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    return ctx;
  }, []);

  const ensureWorklet = useCallback(async () => {
    const ctx = await ensureContext();
    if (workletNodeRef.current) {
      return { ctx, worklet: workletNodeRef.current };
    }
    await ctx.audioWorklet.addModule("/voice-processor.js");
    const worklet = new AudioWorkletNode(ctx, "voice-processor");
    worklet.connect(ctx.destination);
    workletNodeRef.current = worklet;
    return { ctx, worklet };
  }, [ensureContext]);

  const startCapture = useCallback(
    async (
      client: VoiceStreamClient,
      onSpeechStart: () => void,
      onSpeechEnd: () => void
    ) => {
      const stream = await getMediaStream();
      const { ctx, worklet } = await ensureWorklet();

      // VAD Setup
      const vad = new EnergyVAD();
      vad.start(stream);
      vadRef.current = vad;
      setAnalyser(vad.getAnalyser());

      vad.on((event) => {
        if (event === "speech_start") {
          worklet.port.postMessage({ type: "clear" });
          onSpeechStart();
        } else if (event === "speech_end") {
          onSpeechEnd();
        }
      });

      // Audio Graph
      const source = ctx.createMediaStreamSource(stream);
      streamRef.current = stream;
      source.connect(worklet);

      // Processor Message Handler
      worklet.port.onmessage = async (event) => {
        const { type, buffer } = event.data;
        if (type === "audio_data" && buffer) {
          try {
            // Downsample Float32(CtxRate) -> Int16(16kHz)
            const ratio = ctx.sampleRate / 16_000;
            const newLength = Math.floor(buffer.length / ratio);
            const int16 = new Int16Array(newLength);

            for (let i = 0; i < newLength; i++) {
              const idx = Math.floor(i * ratio);
              const val = buffer[idx];
              const s = Math.max(-1, Math.min(1, val));
              int16[i] = s < 0 ? s * 0x80_00 : s * 0x7F_FF;
            }

            await client.sendAudioChunk({
              audio: int16.buffer,
              mimeType: "audio/raw;codec=pcm_s16le;rate=16000",
            });
          } catch {
            // ignore chunk errors
          }
        }
      };
    },
    [ensureWorklet]
  );

  const stopCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (vadRef.current) {
      vadRef.current.stop();
      vadRef.current = null;
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
      // Note: We destroy worklet to stop processing events.
      // Re-creating it is cheap enough for session granularity.
    }
  }, []);

  const playAudio = useCallback(
    async (floatData: Float32Array) => {
      const { worklet } = await ensureWorklet();
      worklet.port.postMessage({ type: "write", payload: floatData }, [
        floatData.buffer,
      ]);
    },
    [ensureWorklet]
  );

  const clearAudio = useCallback(() => {
    workletNodeRef.current?.port.postMessage({ type: "clear" });
  }, []);

  useEffect(
    () => () => {
      stopCapture();
      audioContextRef.current?.close().catch(() => {});
    },
    [stopCapture]
  );

  return {
    startCapture,
    stopCapture,
    playAudio,
    clearAudio,
    analyser,
  };
}
