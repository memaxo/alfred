/**
 * Visual Preferences Hook
 *
 * Manages loading, saving, and applying visual configurations
 * to the Cortex rendering engine.
 */

import type { CortexEngine } from "@alfred/cortex";
import { getDefaultPreset, getPreset } from "@alfred/cortex/presets";
import type {
  VisualConfig,
  VisualConfigUpdate,
  VisualPreset,
} from "@alfred/type";
import { useCallback, useEffect, useMemo, useState } from "react";
import { trpc } from "@/utils/trpc";

export type UseVisualPreferencesOptions = {
  /** Cortex engine to apply config changes to */
  engine?: CortexEngine | null;
  /** Auto-apply changes to engine */
  autoApply?: boolean;
  /** Enable optimistic updates */
  optimistic?: boolean;
};

export type UseVisualPreferencesResult = {
  /** Current visual configuration */
  config: VisualConfig;
  /** Whether config is loading */
  isLoading: boolean;
  /** Error if any */
  error: { message: string } | null;
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Update the entire config */
  setConfig: (config: VisualConfig) => void;
  /** Update specific settings */
  updateConfig: (updates: VisualConfigUpdate) => void;
  /** Apply a preset */
  applyPreset: (preset: VisualPreset) => void;
  /** Reset to defaults */
  reset: () => void;
  /** Save current config to server */
  save: () => Promise<void>;
  /** Export config as JSON string */
  exportConfig: () => string;
  /** Import config from JSON string */
  importConfig: (json: string) => boolean;
  /** Reload from server */
  refetch: () => void;
};

/**
 * Hook for managing visual preferences with Cortex engine integration
 */
export function useVisualPreferences(
  options: UseVisualPreferencesOptions = {}
): UseVisualPreferencesResult {
  const { engine, autoApply = true, optimistic = true } = options;

  // Local state for immediate updates
  const [localConfig, setLocalConfig] = useState<VisualConfig>(
    getDefaultPreset()
  );
  const [isDirty, setIsDirty] = useState(false);

  // Fetch config from server
  const configQuery = trpc.visual.getConfig.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 minute cache
    retry: 1,
  });

  // Mutations
  const setConfigMutation = trpc.visual.setConfig.useMutation();
  const updateConfigMutation = trpc.visual.updateConfig.useMutation();
  const setPresetMutation = trpc.visual.setPreset.useMutation();
  const resetMutation = trpc.visual.resetToDefault.useMutation();

  // Sync server config to local state
  useEffect(() => {
    if (configQuery.data && !isDirty) {
      setLocalConfig(configQuery.data);
    }
  }, [configQuery.data, isDirty]);

  // Apply config to engine when it changes
  useEffect(() => {
    async function apply() {
      if (engine && autoApply) {
        // Using variable-based dynamic import to prevent static analysis bundling
        const configPkg = "@alfred/cortex/config";
        const { applyVisualConfig } = await import(
          /* @vite-ignore */ configPkg
        );
        applyVisualConfig(engine, localConfig);
      }
    }
    apply();
  }, [engine, localConfig, autoApply]);

  // Update local config immediately for responsiveness
  const setConfig = useCallback(
    (config: VisualConfig) => {
      setLocalConfig(config);
      setIsDirty(true);

      // Optimistic engine update
      if (engine && autoApply) {
        const configPkg = "@alfred/cortex/config";
        import(/* @vite-ignore */ configPkg).then(({ applyVisualConfig }) => {
          applyVisualConfig(engine, config);
        });
      }
    },
    [engine, autoApply]
  );

  // Partial update
  const updateConfig = useCallback(
    (updates: VisualConfigUpdate) => {
      setLocalConfig((prev) => {
        const updated: VisualConfig = {
          ...prev,
          preset: updates.preset ?? "custom",
          particles: { ...prev.particles, ...updates.particles },
          corona: { ...prev.corona, ...updates.corona },
          bloom: { ...prev.bloom, ...updates.bloom },
          chromaticAberration: {
            ...prev.chromaticAberration,
            ...updates.chromaticAberration,
          },
          colors: { ...prev.colors, ...updates.colors },
          atmosphere: { ...prev.atmosphere, ...updates.atmosphere },
          nodes: { ...prev.nodes, ...updates.nodes },
          edges: { ...prev.edges, ...updates.edges },
        };

        // Optimistic engine update
        if (engine && autoApply) {
          const configPkg = "@alfred/cortex/config";
          import(/* @vite-ignore */ configPkg).then(({ applyVisualConfig }) => {
            applyVisualConfig(engine, updated);
          });
        }

        return updated;
      });
      setIsDirty(true);
    },
    [engine, autoApply]
  );

  // Apply preset
  const applyPreset = useCallback(
    (preset: VisualPreset) => {
      const config = getPreset(preset);
      setLocalConfig(config);
      setIsDirty(true);

      // Optimistic engine update
      if (engine && autoApply) {
        const configPkg = "@alfred/cortex/config";
        import(/* @vite-ignore */ configPkg).then(({ applyVisualConfig }) => {
          applyVisualConfig(engine, config);
        });
      }

      // Auto-save preset changes
      if (optimistic) {
        setPresetMutation.mutate({ preset });
      }
    },
    [engine, autoApply, optimistic, setPresetMutation]
  );

  // Reset to defaults
  const reset = useCallback(() => {
    const defaultConfig = getDefaultPreset();
    setLocalConfig(defaultConfig);
    setIsDirty(false);

    // Apply to engine
    if (engine && autoApply) {
      const configPkg = "@alfred/cortex/config";
      import(/* @vite-ignore */ configPkg).then(({ applyVisualConfig }) => {
        applyVisualConfig(engine, defaultConfig);
      });
    }

    // Reset on server
    resetMutation.mutate(undefined, {
      onSuccess: () => {
        configQuery.refetch();
      },
    });
  }, [engine, autoApply, resetMutation, configQuery]);

  // Save to server
  const save = useCallback(async () => {
    await setConfigMutation.mutateAsync(localConfig);
    setIsDirty(false);
  }, [localConfig, setConfigMutation]);

  // Export as JSON
  const exportConfig = useCallback(
    () =>
      JSON.stringify(
        {
          version: 1,
          config: localConfig,
          exportedAt: new Date().toISOString(),
        },
        null,
        2
      ),
    [localConfig]
  );

  // Import from JSON
  const importConfig = useCallback(
    (json: string): boolean => {
      try {
        const parsed = JSON.parse(json);
        if (parsed.version !== 1 || !parsed.config) {
          return false;
        }

        setLocalConfig(parsed.config);
        setIsDirty(true);

        // Apply to engine
        if (engine && autoApply) {
          const configPkg = "@alfred/cortex/config";
          import(/* @vite-ignore */ configPkg).then(({ applyVisualConfig }) => {
            applyVisualConfig(engine, parsed.config);
          });
        }

        return true;
      } catch {
        return false;
      }
    },
    [engine, autoApply]
  );

  // Refetch from server
  const refetch = useCallback(() => {
    setIsDirty(false);
    configQuery.refetch();
  }, [configQuery]);

  // Combined error
  const error = useMemo(() => {
    if (configQuery.error) {
      return configQuery.error;
    }
    if (setConfigMutation.error) {
      return setConfigMutation.error;
    }
    if (updateConfigMutation.error) {
      return updateConfigMutation.error;
    }
    if (setPresetMutation.error) {
      return setPresetMutation.error;
    }
    if (resetMutation.error) {
      return resetMutation.error;
    }
    return null;
  }, [
    configQuery.error,
    setConfigMutation.error,
    updateConfigMutation.error,
    setPresetMutation.error,
    resetMutation.error,
  ]);

  return {
    config: localConfig,
    isLoading: configQuery.isLoading,
    error,
    isDirty,
    setConfig,
    updateConfig,
    applyPreset,
    reset,
    save,
    exportConfig,
    importConfig,
    refetch,
  };
}

/**
 * Hook for preset selection only (simpler interface)
 */
export function useVisualPreset() {
  const configQuery = trpc.visual.getConfig.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
  });
  const setPresetMutation = trpc.visual.setPreset.useMutation();

  const preset = useMemo<VisualPreset>(
    () => (configQuery.data?.preset as VisualPreset) ?? "balanced",
    [configQuery.data]
  );

  const setPreset = useCallback(
    async (newPreset: VisualPreset) => {
      await setPresetMutation.mutateAsync({ preset: newPreset });
      configQuery.refetch();
    },
    [setPresetMutation, configQuery]
  );

  return {
    preset,
    setPreset,
    isLoading: configQuery.isLoading || setPresetMutation.isPending,
  };
}
