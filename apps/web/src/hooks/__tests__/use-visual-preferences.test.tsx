/**
 * Visual Preferences Hook Tests
 *
 * Tests for the useVisualPreferences hook.
 * Uses minimal mocking to test hook logic.
 */

import "@/test/dom";
import { beforeEach, describe, expect, it, mock, vi } from "bun:test";
import type { VisualConfig } from "@alfred/type";
import { act, renderHook } from "@testing-library/react";

// Test presets
const PRESET_BALANCED: VisualConfig = {
  preset: "balanced",
  particles: {
    count: 3000,
    spawnRadius: 600,
    gravityConstant: 5000,
    damping: 0.998,
    minDistance: 50,
  },
  corona: {
    fiberCount: 2000,
    segmentsPerFiber: 50,
    innerRadius: 150,
    outerRadius: 400,
    rotationSpeed: 0.104_72,
    spiralTightness: 0.15,
    wobbleAmplitude: 0.15,
  },
  bloom: {
    enabled: true,
    threshold: 0.8,
    intensity: 0.5,
    blurRadius: 2.0,
  },
  chromaticAberration: {
    enabled: true,
    intensity: 0.003,
  },
  colors: {
    primary: "oklch(0.85 0.15 180)",
    secondary: "oklch(0.80 0.12 210)",
    accent: "oklch(0.75 0.15 60)",
    void: "oklch(0.05 0 0)",
    biolum: "oklch(0.99 0 0)",
  },
  atmosphere: {
    enabled: true,
    fogDensity: 0.15,
    fogInnerRadius: 200,
    fogOuterRadius: 600,
    fiberIntensity: 0.08,
    vignetteIntensity: 0.3,
  },
  nodes: {
    glowIntensity: 0.5,
    outerGlowFalloff: 0.05,
    innerGlowIntensity: 0.4,
    ringWidth: 2,
    activityPulseSpeed: 3,
  },
  edges: {
    particleSpeed: 0.15,
    particlesPerEdge: 200,
    curvature: 0.3,
    wobbleAmplitude: 1.5,
    dormantAlpha: 0.1,
    activeAlpha: 0.8,
  },
};

const PRESET_MINIMAL: VisualConfig = {
  ...PRESET_BALANCED,
  preset: "minimal",
  particles: { ...PRESET_BALANCED.particles, count: 500 },
  bloom: { ...PRESET_BALANCED.bloom, enabled: false },
};

const applyVisualConfigMock = vi.fn();
const getDefaultPresetMock = vi.fn(() => PRESET_BALANCED);
const getPresetMock = vi.fn((name: string): VisualConfig => {
  if (name === "minimal") {
    return PRESET_MINIMAL;
  }
  return PRESET_BALANCED;
});

// Mock @alfred/cortex - must export all functions that the hook imports
mock.module("@alfred/cortex", () => ({
  applyVisualConfig: applyVisualConfigMock,
  getDefaultPreset: getDefaultPresetMock,
  getPreset: getPresetMock,
  CortexEngine: class {},
  // Add other exports that might be needed
  applyPreset: vi.fn(),
  getVisualConfig: vi.fn(() => PRESET_BALANCED),
  updateVisualConfig: vi.fn(),
  interpolateConfig: vi.fn(),
  animateConfig: vi.fn(),
  parseOklch: vi.fn(() => ({ r: 0, g: 0, b: 0 })),
  rgbToOklch: vi.fn(() => "oklch(0 0 0)"),
  PRESET_BALANCED,
  PRESET_MINIMAL,
  PRESET_METADATA: [],
  VISUAL_PRESETS: {},
  mergeWithPreset: vi.fn(),
}));

// Create mock tRPC functions
const mockQueryData = {
  data: PRESET_BALANCED,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};
const mockMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  error: null,
  isPending: false,
};

// Mock trpc client
mock.module("@/utils/trpc", () => ({
  trpc: {
    visual: {
      getConfig: {
        useQuery: vi.fn(() => mockQueryData),
      },
      setConfig: {
        useMutation: vi.fn(() => mockMutation),
      },
      updateConfig: {
        useMutation: vi.fn(() => mockMutation),
      },
      setPreset: {
        useMutation: vi.fn(() => mockMutation),
      },
      resetToDefault: {
        useMutation: vi.fn(() => ({
          ...mockMutation,
          mutate: vi.fn((_: unknown, options?: { onSuccess?: () => void }) => {
            options?.onSuccess?.();
          }),
        })),
      },
    },
  },
}));

// Now import the hook after mocks are set up
import {
  useVisualPreferences,
  useVisualPreset,
} from "@/hooks/use-visual-preferences";

beforeEach(() => {
  applyVisualConfigMock.mockClear();
  mockQueryData.refetch.mockClear();
  mockMutation.mutate.mockClear();
  mockMutation.mutateAsync.mockClear().mockResolvedValue({});
});

describe("useVisualPreferences", () => {
  describe("initial state", () => {
    it("starts with default preset", () => {
      const { result } = renderHook(() => useVisualPreferences());

      expect(result.current.config).toBeDefined();
      expect(result.current.config.preset).toBe("balanced");
      expect(result.current.isDirty).toBe(false);
    });

    it("reports loading state from query", () => {
      const { result } = renderHook(() => useVisualPreferences());

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("setConfig", () => {
    it("updates local config immediately", () => {
      const { result } = renderHook(() => useVisualPreferences());

      act(() => {
        result.current.setConfig({
          ...PRESET_BALANCED,
          particles: { ...PRESET_BALANCED.particles, count: 5000 },
        });
      });

      expect(result.current.config.particles.count).toBe(5000);
      expect(result.current.isDirty).toBe(true);
    });

    it("applies to engine when autoApply is true", () => {
      const mockEngine = {
        getCamera: vi.fn(() => ({ center: { x: 0, y: 0 } })),
      };
      const { result } = renderHook(() =>
        useVisualPreferences({
          engine: mockEngine as unknown as any,
          autoApply: true,
        })
      );

      act(() => {
        result.current.setConfig(PRESET_MINIMAL);
      });

      expect(applyVisualConfigMock).toHaveBeenCalled();
    });
  });

  describe("updateConfig", () => {
    it("merges partial updates", () => {
      const { result } = renderHook(() => useVisualPreferences());

      act(() => {
        result.current.updateConfig({
          particles: { count: 6000 },
        });
      });

      expect(result.current.config.particles.count).toBe(6000);
      // Other values should remain
      expect(result.current.config.corona.fiberCount).toBe(2000);
    });

    it("sets preset to custom when updating", () => {
      const { result } = renderHook(() => useVisualPreferences());

      act(() => {
        result.current.updateConfig({
          particles: { count: 7000 },
        });
      });

      expect(result.current.config.preset).toBe("custom");
    });

    it("marks config as dirty", () => {
      const { result } = renderHook(() => useVisualPreferences());

      act(() => {
        result.current.updateConfig({
          bloom: { intensity: 0.8 },
        });
      });

      expect(result.current.isDirty).toBe(true);
    });
  });

  describe("applyPreset", () => {
    it("loads preset configuration", () => {
      const { result } = renderHook(() => useVisualPreferences());

      act(() => {
        result.current.applyPreset("minimal");
      });

      expect(result.current.config.preset).toBe("minimal");
      expect(result.current.config.particles.count).toBe(500);
      expect(result.current.config.bloom.enabled).toBe(false);
    });

    it("marks as dirty", () => {
      const { result } = renderHook(() => useVisualPreferences());

      act(() => {
        result.current.applyPreset("minimal");
      });

      expect(result.current.isDirty).toBe(true);
    });
  });

  describe("reset", () => {
    it("resets to default config", () => {
      const { result } = renderHook(() => useVisualPreferences());

      // First modify
      act(() => {
        result.current.updateConfig({
          particles: { count: 9000 },
        });
      });

      // Then reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.config.preset).toBe("balanced");
      expect(result.current.config.particles.count).toBe(3000);
      expect(result.current.isDirty).toBe(false);
    });
  });

  describe("save", () => {
    it("calls mutation with current config", async () => {
      const { result } = renderHook(() => useVisualPreferences());

      act(() => {
        result.current.updateConfig({
          particles: { count: 4000 },
        });
      });

      await act(async () => {
        await result.current.save();
      });

      expect(mockMutation.mutateAsync).toHaveBeenCalled();
    });

    it("clears dirty flag on save", async () => {
      const { result } = renderHook(() => useVisualPreferences());

      act(() => {
        result.current.updateConfig({
          particles: { count: 4000 },
        });
      });

      expect(result.current.isDirty).toBe(true);

      await act(async () => {
        await result.current.save();
      });

      expect(result.current.isDirty).toBe(false);
    });
  });

  describe("exportConfig", () => {
    it("returns JSON string with version", () => {
      const { result } = renderHook(() => useVisualPreferences());

      const exported = result.current.exportConfig();
      const parsed = JSON.parse(exported);

      expect(parsed.version).toBe(1);
      expect(parsed.config).toBeDefined();
      expect(parsed.config.preset).toBe("balanced");
      expect(parsed.exportedAt).toBeDefined();
    });

    it("includes current config", () => {
      const { result } = renderHook(() => useVisualPreferences());

      act(() => {
        result.current.updateConfig({
          particles: { count: 5500 },
        });
      });

      const exported = result.current.exportConfig();
      const parsed = JSON.parse(exported);

      expect(parsed.config.particles.count).toBe(5500);
    });
  });

  describe("importConfig", () => {
    it("imports valid config", () => {
      const { result } = renderHook(() => useVisualPreferences());

      const toImport = {
        version: 1,
        config: {
          ...PRESET_BALANCED,
          particles: { ...PRESET_BALANCED.particles, count: 6500 },
        },
        exportedAt: new Date().toISOString(),
      };

      act(() => {
        const success = result.current.importConfig(JSON.stringify(toImport));
        expect(success).toBe(true);
      });

      expect(result.current.config.particles.count).toBe(6500);
      expect(result.current.isDirty).toBe(true);
    });

    it("rejects invalid version", () => {
      const { result } = renderHook(() => useVisualPreferences());

      const toImport = {
        version: 2,
        config: PRESET_BALANCED,
      };

      let success: boolean | undefined;
      act(() => {
        success = result.current.importConfig(JSON.stringify(toImport));
      });

      expect(success).toBe(false);
    });

    it("rejects invalid JSON", () => {
      const { result } = renderHook(() => useVisualPreferences());

      let success: boolean | undefined;
      act(() => {
        success = result.current.importConfig("not valid json");
      });

      expect(success).toBe(false);
    });

    it("rejects missing config", () => {
      const { result } = renderHook(() => useVisualPreferences());

      const toImport = {
        version: 1,
        // missing config
      };

      let success: boolean | undefined;
      act(() => {
        success = result.current.importConfig(JSON.stringify(toImport));
      });

      expect(success).toBe(false);
    });
  });

  describe("engine integration", () => {
    it("applies config to engine on mount", () => {
      const mockEngine = {
        getCamera: vi.fn(() => ({ center: { x: 0, y: 0 } })),
      };

      renderHook(() =>
        useVisualPreferences({
          engine: mockEngine as unknown as any,
          autoApply: true,
        })
      );

      expect(applyVisualConfigMock).toHaveBeenCalled();
    });

    it("does not apply when autoApply is false", () => {
      const mockEngine = {
        getCamera: vi.fn(() => ({ center: { x: 0, y: 0 } })),
      };
      applyVisualConfigMock.mockClear();

      const { result } = renderHook(() =>
        useVisualPreferences({
          engine: mockEngine as unknown as any,
          autoApply: false,
        })
      );

      act(() => {
        result.current.setConfig(PRESET_MINIMAL);
      });

      expect(applyVisualConfigMock).not.toHaveBeenCalled();
    });
  });
});

describe("useVisualPreset", () => {
  it("returns current preset", () => {
    const { result } = renderHook(() => useVisualPreset());

    expect(result.current.preset).toBe("balanced");
  });

  it("provides loading state", () => {
    const { result } = renderHook(() => useVisualPreset());

    expect(typeof result.current.isLoading).toBe("boolean");
  });

  it("provides setPreset function", () => {
    const { result } = renderHook(() => useVisualPreset());

    expect(typeof result.current.setPreset).toBe("function");
  });
});
