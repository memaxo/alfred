/**
 * Visual Configuration Router
 *
 * tRPC endpoints for managing Cortex visual preferences.
 * Persists visual configurations using the existing preference system.
 */

import { userRepo } from "@alfred/db";
import {
  type VisualConfig,
  type VisualPreset,
  visualConfigSchema,
  visualConfigUpdateSchema,
  visualPresetSchema,
} from "@alfred/type";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authedProcedure, router } from "../trpc";

/**
 * Preference key prefix for visual settings
 */
const VISUAL_PREFIX = "visual.";

/**
 * Flatten visual config into preference key-value pairs
 */
function flattenConfig(
  config: VisualConfig
): Array<{ key: string; value: unknown }> {
  const pairs: Array<{ key: string; value: unknown }> = [];

  // Preset
  pairs.push({ key: `${VISUAL_PREFIX}preset`, value: config.preset });

  // Flatten each category
  for (const [category, settings] of Object.entries(config)) {
    if (category === "preset") {
      continue;
    }
    if (typeof settings === "object" && settings !== null) {
      for (const [setting, value] of Object.entries(settings)) {
        pairs.push({ key: `${VISUAL_PREFIX}${category}.${setting}`, value });
      }
    }
  }

  return pairs;
}

/**
 * Reconstruct visual config from preference entries
 */
function unflattenPreferences(
  preferences: Array<{ key: string; value: unknown }>
): Partial<VisualConfig> {
  const config: Record<string, unknown> = {};

  for (const { key, value } of preferences) {
    if (!key.startsWith(VISUAL_PREFIX)) {
      continue;
    }

    const path = key.slice(VISUAL_PREFIX.length);
    const parts = path.split(".");

    const firstPart = parts[0];
    if (parts.length === 1 && firstPart) {
      // Top-level key (e.g., preset)
      config[firstPart] = value;
    } else if (parts.length === 2) {
      // Nested key (e.g., particles.count)
      const category = parts[0];
      const setting = parts[1];
      if (category && setting) {
        if (!config[category]) {
          config[category] = {};
        }
        (config[category] as Record<string, unknown>)[setting] = value;
      }
    }
  }

  return config as Partial<VisualConfig>;
}

/**
 * Get default config with preset values
 */
async function getDefaultConfig(): Promise<VisualConfig> {
  // Dynamically import to avoid bundling cortex in client
  const cortexModule = "@alfred/cortex";
  const { getPreset } = await import(cortexModule);
  return getPreset("balanced") as VisualConfig;
}

export const visualRouter = router({
  /**
   * Get current visual configuration
   * Returns stored preferences merged with defaults
   */
  getConfig: authedProcedure.query(async ({ ctx }): Promise<VisualConfig> => {
    const session = ctx.session;
    if (!session?.user?.id) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "session_required",
      });
    }

    // Load all visual preferences
    const preferences = await userRepo.getPreferences(session.user.id);
    const visualPrefs = (Array.isArray(preferences) ? preferences : []).filter(
      (p) => p.key.startsWith(VISUAL_PREFIX)
    );

    // Get default config
    const defaultConfig = await getDefaultConfig();

    // If no visual preferences, return default
    if (visualPrefs.length === 0) {
      return defaultConfig;
    }

    // Merge stored preferences with defaults
    const stored = unflattenPreferences(visualPrefs);

    // Deep merge with defaults
    const merged: VisualConfig = {
      preset: (stored.preset as VisualPreset) ?? defaultConfig.preset,
      particles: { ...defaultConfig.particles, ...stored.particles },
      corona: { ...defaultConfig.corona, ...stored.corona },
      bloom: { ...defaultConfig.bloom, ...stored.bloom },
      chromaticAberration: {
        ...defaultConfig.chromaticAberration,
        ...stored.chromaticAberration,
      },
      colors: { ...defaultConfig.colors, ...stored.colors },
      atmosphere: { ...defaultConfig.atmosphere, ...stored.atmosphere },
      nodes: { ...defaultConfig.nodes, ...stored.nodes },
      edges: { ...defaultConfig.edges, ...stored.edges },
    };

    return visualConfigSchema.parse(merged);
  }),

  /**
   * Set the entire visual configuration
   * Replaces all visual preferences
   */
  setConfig: authedProcedure
    .input(visualConfigSchema)
    .mutation(async ({ ctx, input }): Promise<{ updated: number }> => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      // Flatten config into key-value pairs
      const pairs = flattenConfig(input);

      // Save all preferences
      await Promise.all(
        pairs.map(({ key, value }) =>
          userRepo.setPreference(session.user.id, key, value, 1.0, "user")
        )
      );

      return { updated: pairs.length };
    }),

  /**
   * Update specific visual settings
   * Merges with existing config
   */
  updateConfig: authedProcedure
    .input(visualConfigUpdateSchema)
    .mutation(async ({ ctx, input }): Promise<{ updated: number }> => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      // Build flattened pairs from partial update
      const pairs: Array<{ key: string; value: unknown }> = [];

      if (input.preset !== undefined) {
        pairs.push({ key: `${VISUAL_PREFIX}preset`, value: input.preset });
      }

      for (const [category, settings] of Object.entries(input)) {
        if (category === "preset") {
          continue;
        }
        if (typeof settings === "object" && settings !== null) {
          for (const [setting, value] of Object.entries(settings)) {
            if (value !== undefined) {
              pairs.push({
                key: `${VISUAL_PREFIX}${category}.${setting}`,
                value,
              });
            }
          }
        }
      }

      // Save updated preferences
      await Promise.all(
        pairs.map(({ key, value }) =>
          userRepo.setPreference(session.user.id, key, value, 1.0, "user")
        )
      );

      return { updated: pairs.length };
    }),

  /**
   * Apply a preset (minimal, balanced, performance, maximum)
   * Loads preset values and saves them
   */
  setPreset: authedProcedure
    .input(z.object({ preset: visualPresetSchema }))
    .mutation(async ({ ctx, input }): Promise<{ preset: VisualPreset }> => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      // Dynamically import preset
      const cortexModule = "@alfred/cortex";
      const { getPreset } = await import(cortexModule);
      const config = getPreset(input.preset) as VisualConfig;

      // Save all preset values
      const pairs = flattenConfig(config);
      await Promise.all(
        pairs.map(({ key, value }) =>
          userRepo.setPreference(session.user.id, key, value, 1.0, "user")
        )
      );

      return { preset: input.preset };
    }),

  /**
   * Reset to default (balanced) preset
   */
  resetToDefault: authedProcedure.mutation(
    async ({ ctx }): Promise<{ reset: boolean }> => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      // Delete all visual preferences
      const preferences = await userRepo.getPreferences(session.user.id);
      const visualPrefs = (
        Array.isArray(preferences) ? preferences : []
      ).filter((p) => p.key.startsWith(VISUAL_PREFIX));

      await Promise.all(
        visualPrefs.map((p) =>
          userRepo.deletePreference(session.user.id, p.key)
        )
      );

      return { reset: true };
    }
  ),

  /**
   * Export config as JSON for sharing
   */
  exportConfig: authedProcedure.query(
    async ({
      ctx,
    }): Promise<{
      version: number;
      config: VisualConfig;
      exportedAt: string;
    }> => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      // Load all visual preferences
      const preferences = await userRepo.getPreferences(session.user.id);
      const visualPrefs = (
        Array.isArray(preferences) ? preferences : []
      ).filter((p) => p.key.startsWith(VISUAL_PREFIX));

      const defaultConfig = await getDefaultConfig();
      const stored = unflattenPreferences(visualPrefs);

      const config: VisualConfig = {
        preset: (stored.preset as VisualPreset) ?? defaultConfig.preset,
        particles: { ...defaultConfig.particles, ...stored.particles },
        corona: { ...defaultConfig.corona, ...stored.corona },
        bloom: { ...defaultConfig.bloom, ...stored.bloom },
        chromaticAberration: {
          ...defaultConfig.chromaticAberration,
          ...stored.chromaticAberration,
        },
        colors: { ...defaultConfig.colors, ...stored.colors },
        atmosphere: { ...defaultConfig.atmosphere, ...stored.atmosphere },
        nodes: { ...defaultConfig.nodes, ...stored.nodes },
        edges: { ...defaultConfig.edges, ...stored.edges },
      };

      return {
        version: 1,
        config: visualConfigSchema.parse(config),
        exportedAt: new Date().toISOString(),
      };
    }
  ),

  /**
   * Import config from JSON
   */
  importConfig: authedProcedure
    .input(
      z.object({
        version: z.literal(1),
        config: visualConfigSchema,
      })
    )
    .mutation(async ({ ctx, input }): Promise<{ imported: boolean }> => {
      const session = ctx.session;
      if (!session?.user?.id) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "session_required",
        });
      }

      // Save all config values
      const pairs = flattenConfig(input.config);
      await Promise.all(
        pairs.map(({ key, value }) =>
          userRepo.setPreference(session.user.id, key, value, 1.0, "user")
        )
      );

      return { imported: true };
    }),
});
