/**
 * Cortex Engine React Hook
 *
 * Manages the lifecycle of the Cortex WebGPU rendering engine.
 */

import type { CortexConfig, CortexEngine } from "@alfred/cortex";

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
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
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
    if (!canvas || initializingRef.current) {
      return;
    }

    initializingRef.current = true;
    setError(null);
    setIsReady(false);

    async function init() {
      try {
        // 1. Check for WebGPU flag (Vite compile-time gating)
        if (import.meta.env.VITE_MINDSCAPE_WEBGPU !== "1") {
          setError(new Error("cortex_webgpu_disabled"));
          setIsReady(true);
          return;
        }

        // 2. Dynamic import of Cortex modules to prevent WebGPU code leakage
        // Using variable-based dynamic imports to prevent static analysis bundling
        const cortexPkg = "@alfred/cortex";
        const atmospherePkg = "@alfred/cortex/systems/atmosphere";
        const coronaPkg = "@alfred/cortex/systems/corona";
        const edgesPkg = "@alfred/cortex/systems/edges";
        const nodesPkg = "@alfred/cortex/systems/nodes";
        const particlesPkg = "@alfred/cortex/systems/particles";
        const postprocessPkg = "@alfred/cortex/systems/postprocess";

        const [
          { CortexEngine, detectRenderingCapability },
          { AtmosphereSystem },
          { CoronaSystem },
          { EdgeSystem },
          { NodeSystem },
          { ParticleSystem },
          { PostProcessSystem },
        ] = await Promise.all([
          import(cortexPkg),
          import(atmospherePkg),
          import(coronaPkg),
          import(edgesPkg),
          import(nodesPkg),
          import(particlesPkg),
          import(postprocessPkg),
        ]);

        // Detect capability
        const cap = (await detectRenderingCapability()) as RenderingCapability;
        setCapability(cap);

        if (cap !== "webgpu") {
          setError(new Error(`cortex_webgpu_required:${cap}`));
          setIsReady(true);
          return;
        }

        // Create engine
        // canvas is guaranteed non-null here due to check above
        const config: CortexConfig = {
          canvas: canvas as HTMLCanvasElement,
          postProcessing,
        };

        const cortex = new CortexEngine(config);
        engineRef.current = cortex;

        // Register render systems
        const orbCenter = {
          x: (canvas?.width ?? 0) / 2,
          y: (canvas?.height ?? 0) / 2,
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
        if (canvas) {
          const w = canvas.width ?? 0;
          const h = canvas.height ?? 0;
          cortex.resize(w, h);
        }

        setEngine(cortex);
        setIsReady(true);
        onReady?.(cortex);

        // Auto-start if enabled
        if (autoStart) {
          cortex.start();
        }
      } catch (error) {
        const errObj =
          error instanceof Error ? error : new Error(String(error));
        setError(errObj);
        setIsReady(true);
        onError?.(errObj);
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
    if (!(canvas && engine)) {
      return;
    }

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
