/**
 * Visual Configuration Router Tests
 *
 * Tests for Cortex visual preference management endpoints.
 * Uses mock DB to test router logic.
 */

import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import type { VisualConfig } from "@alfred/type";
import { dbModuleStub } from "./utils/mock-db-client";
import { mockPolicyAudit, setupTestEnv } from "./utils/router-helpers";

setupTestEnv();
mockPolicyAudit();

// Define test preset configurations
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
  corona: { ...PRESET_BALANCED.corona, fiberCount: 500 },
  bloom: { ...PRESET_BALANCED.bloom, enabled: false },
};

const PRESET_MAXIMUM: VisualConfig = {
  ...PRESET_BALANCED,
  preset: "maximum",
  particles: { ...PRESET_BALANCED.particles, count: 8000 },
  corona: { ...PRESET_BALANCED.corona, fiberCount: 3500 },
};

// Mock @alfred/cortex
mock.module("@alfred/cortex", () => ({
  getPreset: vi.fn((name: string): VisualConfig => {
    if (name === "minimal") {
      return PRESET_MINIMAL;
    }
    if (name === "maximum") {
      return PRESET_MAXIMUM;
    }
    return PRESET_BALANCED;
  }),
  getDefaultPreset: vi.fn(() => PRESET_BALANCED),
  PRESET_BALANCED,
  PRESET_MINIMAL,
  PRESET_MAXIMUM,
}));

// Set up mocks for userRepo
const getPreferencesMock = vi.fn();
const setPreferenceMock = vi.fn();
const deletePreferenceMock = vi.fn();

dbModuleStub.userRepo.getPreferences = getPreferencesMock;
dbModuleStub.userRepo.setPreference = setPreferenceMock;
dbModuleStub.userRepo.deletePreference = deletePreferenceMock;

let caller: Awaited<
  ReturnType<typeof import("./utils/trpc")["createTestCaller"]>
>;

beforeAll(async () => {
  const { createTestCaller } = await import("./utils/trpc");
  caller = await createTestCaller({
    scopes: ["preference.write"],
  });
});

beforeEach(() => {
  getPreferencesMock.mockReset();
  setPreferenceMock.mockReset();
  deletePreferenceMock.mockReset();

  // Default: return balanced preset when setting preferences
  setPreferenceMock.mockImplementation(
    (userId: string, key: string, value: unknown) =>
      Promise.resolve({
        id: `pref-${Date.now()}`,
        userId,
        key,
        value,
        confidence: 1.0,
        source: "user",
      })
  );
});

describe("visual router", () => {
  describe("getConfig", () => {
    it("returns default config when no preferences exist", async () => {
      getPreferencesMock.mockResolvedValue([]);

      const result = await caller.visual.getConfig();

      expect(result.preset).toBe("balanced");
      expect(result.particles.count).toBe(3000);
      expect(result.corona.fiberCount).toBe(2000);
    });

    it("returns stored preferences merged with defaults", async () => {
      getPreferencesMock.mockResolvedValue([
        { key: "visual.preset", value: "custom" },
        { key: "visual.particles.count", value: 5000 },
        { key: "visual.bloom.intensity", value: 0.8 },
      ]);

      const result = await caller.visual.getConfig();

      expect(result.preset).toBe("custom");
      expect(result.particles.count).toBe(5000);
      expect(result.bloom.intensity).toBe(0.8);
      // Other values should be defaults
      expect(result.corona.fiberCount).toBe(2000);
    });

    it("ignores non-visual preferences", async () => {
      getPreferencesMock.mockResolvedValue([
        { key: "theme", value: "dark" },
        { key: "visual.particles.count", value: 4000 },
      ]);

      const result = await caller.visual.getConfig();

      expect(result.particles.count).toBe(4000);
    });
  });

  describe("setConfig", () => {
    it("flattens and stores complete config", async () => {
      const config: VisualConfig = {
        ...PRESET_BALANCED,
        particles: { ...PRESET_BALANCED.particles, count: 5000 },
      };

      const result = await caller.visual.setConfig(config);

      // Should have called setPreference multiple times
      expect(setPreferenceMock).toHaveBeenCalled();
      // Count the calls (preset + particles fields + corona fields + etc)
      const calls = setPreferenceMock.mock.calls;
      expect(calls.length).toBeGreaterThan(10);

      // Check specific calls
      const presetCall = calls.find((c: unknown[]) => c[1] === "visual.preset");
      expect(presetCall?.[2]).toBe("balanced");

      const particleCountCall = calls.find(
        (c: unknown[]) => c[1] === "visual.particles.count"
      );
      expect(particleCountCall?.[2]).toBe(5000);

      expect(result.updated).toBeGreaterThan(0);
    });

    it("stores all nested properties", async () => {
      await caller.visual.setConfig(PRESET_BALANCED);

      const calls = setPreferenceMock.mock.calls;
      const keys = calls.map((c: unknown[]) => c[1]);

      // Check various nested keys exist
      expect(keys).toContain("visual.preset");
      expect(keys).toContain("visual.particles.count");
      expect(keys).toContain("visual.corona.fiberCount");
      expect(keys).toContain("visual.bloom.enabled");
      expect(keys).toContain("visual.colors.primary");
      expect(keys).toContain("visual.atmosphere.fogDensity");
      expect(keys).toContain("visual.nodes.glowIntensity");
      expect(keys).toContain("visual.edges.particleSpeed");
    });
  });

  describe("updateConfig", () => {
    it("updates specified fields", async () => {
      const result = await caller.visual.updateConfig({
        particles: { count: 6000 },
      });

      // Check that the specified field was updated
      const calls = setPreferenceMock.mock.calls;
      const countCall = calls.find(
        (c: unknown[]) => c[1] === "visual.particles.count"
      );
      expect(countCall?.[2]).toBe(6000);
      expect(result.updated).toBeGreaterThan(0);
    });

    it("updates multiple nested fields", async () => {
      await caller.visual.updateConfig({
        particles: { count: 4000, spawnRadius: 700 },
        bloom: { intensity: 0.7 },
      });

      const calls = setPreferenceMock.mock.calls;
      const keys = calls.map((c: unknown[]) => c[1]);

      // Verify our specific updates are included
      expect(keys).toContain("visual.particles.count");
      expect(keys).toContain("visual.particles.spawnRadius");
      expect(keys).toContain("visual.bloom.intensity");

      // Verify values
      const countCall = calls.find(
        (c: unknown[]) => c[1] === "visual.particles.count"
      );
      expect(countCall?.[2]).toBe(4000);
      const radiusCall = calls.find(
        (c: unknown[]) => c[1] === "visual.particles.spawnRadius"
      );
      expect(radiusCall?.[2]).toBe(700);
    });

    it("updates preset when specified", async () => {
      await caller.visual.updateConfig({
        preset: "minimal",
      });

      expect(setPreferenceMock).toHaveBeenCalledWith(
        "test-user",
        "visual.preset",
        "minimal",
        1.0,
        "user"
      );
    });

    it("skips undefined values", async () => {
      await caller.visual.updateConfig({
        particles: { count: 5000 },
        // corona is undefined, should not create any calls
      });

      const calls = setPreferenceMock.mock.calls;
      const keys = calls.map((c: unknown[]) => c[1] as string);
      expect(keys.every((k) => k.startsWith("visual.particles"))).toBe(true);
    });
  });

  describe("setPreset", () => {
    it("loads and stores preset configuration", async () => {
      const result = await caller.visual.setPreset({ preset: "minimal" });

      expect(result.preset).toBe("minimal");

      // Should have stored all preset values
      const calls = setPreferenceMock.mock.calls;
      const presetCall = calls.find((c: unknown[]) => c[1] === "visual.preset");
      expect(presetCall?.[2]).toBe("minimal");

      const particleCall = calls.find(
        (c: unknown[]) => c[1] === "visual.particles.count"
      );
      expect(particleCall?.[2]).toBe(500); // minimal preset value
    });

    it("stores maximum preset values", async () => {
      await caller.visual.setPreset({ preset: "maximum" });

      const calls = setPreferenceMock.mock.calls;
      const particleCall = calls.find(
        (c: unknown[]) => c[1] === "visual.particles.count"
      );
      expect(particleCall?.[2]).toBe(8000); // maximum preset value
    });
  });

  describe("resetToDefault", () => {
    it("deletes all visual preferences", async () => {
      getPreferencesMock.mockResolvedValue([
        { key: "visual.preset", value: "custom" },
        { key: "visual.particles.count", value: 5000 },
        { key: "visual.bloom.intensity", value: 0.8 },
        { key: "theme", value: "dark" }, // non-visual, should be ignored
      ]);
      deletePreferenceMock.mockResolvedValue(1);

      const result = await caller.visual.resetToDefault();

      expect(result.reset).toBe(true);
      // Should have deleted only visual preferences
      expect(deletePreferenceMock).toHaveBeenCalledTimes(3);

      const deletedKeys = deletePreferenceMock.mock.calls.map(
        (c: unknown[]) => c[1]
      );
      expect(deletedKeys).toContain("visual.preset");
      expect(deletedKeys).toContain("visual.particles.count");
      expect(deletedKeys).toContain("visual.bloom.intensity");
      expect(deletedKeys).not.toContain("theme");
    });

    it("handles empty preferences", async () => {
      getPreferencesMock.mockResolvedValue([]);

      const result = await caller.visual.resetToDefault();

      expect(result.reset).toBe(true);
      expect(deletePreferenceMock).not.toHaveBeenCalled();
    });
  });

  describe("exportConfig", () => {
    it("exports config with metadata", async () => {
      getPreferencesMock.mockResolvedValue([
        { key: "visual.preset", value: "custom" },
        { key: "visual.particles.count", value: 5000 },
      ]);

      const result = await caller.visual.exportConfig();

      expect(result.version).toBe(1);
      expect(result.config.preset).toBe("custom");
      expect(result.config.particles.count).toBe(5000);
      expect(result.exportedAt).toBeDefined();
      expect(new Date(result.exportedAt).getTime()).toBeGreaterThan(0);
    });

    it("exports default config when no preferences", async () => {
      getPreferencesMock.mockResolvedValue([]);

      const result = await caller.visual.exportConfig();

      expect(result.version).toBe(1);
      expect(result.config.preset).toBe("balanced");
      expect(result.config.particles.count).toBe(3000);
    });
  });

  describe("importConfig", () => {
    it("imports config from export format", async () => {
      const importData = {
        version: 1 as const,
        config: {
          ...PRESET_BALANCED,
          particles: { ...PRESET_BALANCED.particles, count: 7000 },
        },
      };

      const result = await caller.visual.importConfig(importData);

      expect(result.imported).toBe(true);

      const calls = setPreferenceMock.mock.calls;
      const particleCall = calls.find(
        (c: unknown[]) => c[1] === "visual.particles.count"
      );
      expect(particleCall?.[2]).toBe(7000);
    });

    it("stores all imported values", async () => {
      await caller.visual.importConfig({
        version: 1,
        config: PRESET_MINIMAL,
      });

      const calls = setPreferenceMock.mock.calls;
      expect(calls.length).toBeGreaterThan(10);

      // Verify specific values from minimal preset
      const bloomCall = calls.find(
        (c: unknown[]) => c[1] === "visual.bloom.enabled"
      );
      expect(bloomCall?.[2]).toBe(false); // minimal has bloom disabled
    });
  });

  describe("authentication", () => {
    it("all endpoints require authentication", async () => {
      const { createUnauthedCaller } = await import("./utils/trpc");
      const unauthedCaller = await createUnauthedCaller();

      // getConfig
      await expect(unauthedCaller.visual.getConfig()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });

      // setConfig
      await expect(
        unauthedCaller.visual.setConfig(PRESET_BALANCED)
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });

      // updateConfig
      await expect(
        unauthedCaller.visual.updateConfig({ particles: { count: 5000 } })
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });

      // setPreset
      await expect(
        unauthedCaller.visual.setPreset({ preset: "minimal" })
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });

      // resetToDefault
      await expect(
        unauthedCaller.visual.resetToDefault()
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });

      // exportConfig
      await expect(unauthedCaller.visual.exportConfig()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });

      // importConfig
      await expect(
        unauthedCaller.visual.importConfig({
          version: 1,
          config: PRESET_BALANCED,
        })
      ).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });
});
