/**
 * Cortex Engine React Hook
 *
 * Manages the lifecycle of the Cortex WebGPU rendering engine.
 */

import {
  type CortexConfig,
  CortexEngine,
  detectRenderingCapability,
  isWebGPUSupported,
} from "@alfred/cortex";
import { AtmosphereSystem } from "@alfred/cortex/systems/atmosphere";
import { CoronaSystem } from "@alfred/cortex/systems/corona";
import { EdgeSystem } from "@alfred/cortex/systems/edges";
import { NodeSystem } from "@alfred/cortex/systems/nodes";
import { ParticleSystem } from "@alfred/cortex/systems/particles";
import { PostProcessSystem } from "@alfred/cortex/systems/postprocess";
import { useCallback, useEffect, useRef, useState } from "react";

export type RenderingCapability = "webgpu" | "webgl" | "canvas2d";

export interface UseCortexEngineOptions {
  /** Enable post-processing effects */
  postProcessing?: boolean;
  /** Callback when engine is ready */
  onReady?: (engine: CortexEngine) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Auto-start render loop */
  autoStart?: boolean;
}

export interface UseCortexEngineResult {
  engine: CortexEngine | null;
  capability: RenderingCapability | null;
  isReady: boolean;
  error: Error | null;
  start: () => void;
  stop: () => void;
}

/**
 * Hook to manage Cortex WebGPU engine lifecycle
 */
export function useCortexEngine(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: UseCortexEngineOptions = {}
): UseCortexEngineResult {
  const { postProcessing = true, onReady, onError, autoStart = true } = options;

  const [engine, setEngine] = useState<CortexEngine | null>(null);
  const [capability, setCapability] = useState<RenderingCapability | null>(
    null
  );
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const engineRef = useRef<CortexEngine | null>(null);
  const initializingRef = useRef(false);

  // Initialize engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || initializingRef.current) return;

    initializingRef.current = true;

    async function init() {
      try {
        // Detect capability
        const cap = await detectRenderingCapability();
        setCapability(cap);

        if (cap !== "webgpu") {
          // TODO: Fall back to WebGL or Canvas2D renderer
          console.warn(`WebGPU not available, falling back to ${cap}`);
          setIsReady(true);
          return;
        }

        // Create engine
        const config: CortexConfig = {
          canvas: canvas!,
          postProcessing,
        };

        const cortex = new CortexEngine(config);
        engineRef.current = cortex;

        // Register render systems
        const orbCenter = {
          x: canvas!.width / 2,
          y: canvas!.height / 2,
        };

        cortex.registerSystem(new AtmosphereSystem());
        cortex.registerSystem(
          new ParticleSystem({
            maxParticles: 3000,
            spawnRadius: 600,
            orbCenter,
          })
        );
        cortex.registerSystem(new CoronaSystem({ orbCenter }));
        cortex.registerSystem(new EdgeSystem(100));
        cortex.registerSystem(new NodeSystem(200));
        cortex.registerSystem(new PostProcessSystem());

        // Initialize WebGPU
        const success = await cortex.init();
        if (!success) {
          throw cortex.getError() ?? new Error("Failed to initialize Cortex");
        }

        // Set initial size
        cortex.resize(canvas!.width, canvas!.height);

        setEngine(cortex);
        setIsReady(true);
        onReady?.(cortex);

        // Auto-start if enabled
        if (autoStart) {
          cortex.start();
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        console.error("Cortex engine init failed:", error);
      } finally {
        initializingRef.current = false;
      }
    }

    init();

    // Cleanup
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, [canvasRef, postProcessing, onReady, onError, autoStart]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!(canvas && engine)) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          canvas.width = width * window.devicePixelRatio;
          canvas.height = height * window.devicePixelRatio;
          engine.resize(canvas.width, canvas.height);
        }
      }
    });

    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
    };
  }, [canvasRef, engine]);

  const start = useCallback(() => {
    engine?.start();
  }, [engine]);

  const stop = useCallback(() => {
    engine?.stop();
  }, [engine]);

  return {
    engine,
    capability,
    isReady,
    error,
    start,
    stop,
  };
}

/**
 * Check if WebGPU is supported (without initializing)
 */
export function useWebGPUSupport(): boolean {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(isWebGPUSupported());
  }, []);

  return supported;
}
