import { DEFAULT_COMPRESSION_CONFIG } from "@alfred/knowledge/compression";

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toFloat = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
};

const coerceBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }
  if (value === "1" || value.toLowerCase() === "true") {
    return true;
  }
  if (value === "0" || value.toLowerCase() === "false") {
    return false;
  }
  return fallback;
};

export const reasoningConfig = {
  extraction: {
    minLength: toInt(process.env.REASONING_MIN_LENGTH, 10),
    maxStored: toInt(process.env.REASONING_MAX_STORED, 1000),
    baseConfidence: toFloat(process.env.REASONING_CONFIDENCE_BASE, 0.7),
  },
  compression: {
    enabled: coerceBool(
      process.env.COMPRESSION_ENABLED,
      process.env.NODE_ENV === "production"
    ),
    intervalMs: toInt(process.env.COMPRESSION_INTERVAL_MS, 60 * 60 * 1000),
    halfLifeMs: toInt(
      process.env.COMPRESSION_HALF_LIFE_MS,
      DEFAULT_COMPRESSION_CONFIG.confidenceDecayHalfLife
    ),
    minConfidence: toFloat(
      process.env.COMPRESSION_MIN_CONFIDENCE,
      DEFAULT_COMPRESSION_CONFIG.minConfidenceThreshold
    ),
    maxAgeMs: toInt(
      process.env.COMPRESSION_MAX_AGE_MS,
      DEFAULT_COMPRESSION_CONFIG.maxAgeThreshold
    ),
    patternMinSupport: DEFAULT_COMPRESSION_CONFIG.patternMinSupport,
    patternMinConfidence: DEFAULT_COMPRESSION_CONFIG.patternMinConfidence,
  },
};

export const compressionWorkerOverrides = () => ({
  enabled: reasoningConfig.compression.enabled,
  intervalMs: reasoningConfig.compression.intervalMs,
  confidenceDecayHalfLife: reasoningConfig.compression.halfLifeMs,
  minConfidenceThreshold: reasoningConfig.compression.minConfidence,
  maxAgeThreshold: reasoningConfig.compression.maxAgeMs,
  patternMinSupport: reasoningConfig.compression.patternMinSupport,
  patternMinConfidence: reasoningConfig.compression.patternMinConfidence,
});
