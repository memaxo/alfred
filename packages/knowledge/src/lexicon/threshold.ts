/**
 * Domain-Adaptive Override Thresholds
 *
 * Instead of a single static LEARNED_OVERRIDE_THRESHOLD (0.8),
 * maintain per-domain thresholds that calibrate based on correction history.
 *
 * Reference: alfred-memory-review.md - "Domain-adaptive thresholds improve accuracy"
 *
 * The threshold adjusts based on user corrections:
 * - If user frequently corrects a domain, lower the threshold (trust static less)
 * - If user rarely corrects a domain, raise the threshold (trust static more)
 *
 * Formula: threshold = base_threshold × (1 - error_rate)
 * Where error_rate = corrections / total_classifications
 */

/**
 * Default threshold when no domain-specific data exists
 */
export const DEFAULT_OVERRIDE_THRESHOLD = 0.8;

/**
 * Minimum threshold (never trust learned less than this)
 */
export const MIN_OVERRIDE_THRESHOLD = 0.5;

/**
 * Maximum threshold (never require more confidence than this)
 */
export const MAX_OVERRIDE_THRESHOLD = 0.95;

/**
 * Number of samples needed before threshold calibration begins
 */
export const MIN_SAMPLES_FOR_CALIBRATION = 10;

/**
 * Domain threshold data
 */
export type DomainThresholdData = {
  domain: string;
  threshold: number;
  correctionCount: number;
  classificationCount: number;
  accuracy: number;
  updatedAt: Date;
};

/**
 * In-memory cache for domain thresholds
 * Populated from database on first access
 */
const thresholdCache = new Map<string, DomainThresholdData>();
let cacheInitialized = false;

/**
 * Callbacks for persistence (injected by preference router)
 */
type ThresholdPersistence = {
  load: () => Promise<DomainThresholdData[]>;
  save: (data: DomainThresholdData) => Promise<void>;
};

let persistence: ThresholdPersistence | null = null;

/**
 * Register persistence callbacks
 */
export function registerThresholdPersistence(
  callbacks: ThresholdPersistence
): void {
  persistence = callbacks;
}

/**
 * Initialize cache from persistence layer
 */
async function initializeCache(): Promise<void> {
  if (cacheInitialized || !persistence) {
    return;
  }

  try {
    const data = await persistence.load();
    for (const item of data) {
      thresholdCache.set(item.domain.toLowerCase(), item);
    }
    cacheInitialized = true;
  } catch (_error) {
    cacheInitialized = true; // Mark initialized to avoid retry loops
  }
}

/**
 * Get override threshold for a specific domain.
 * Returns default if no domain-specific data exists.
 *
 * @param domain - Domain to get threshold for
 * @returns Threshold value between MIN_OVERRIDE_THRESHOLD and MAX_OVERRIDE_THRESHOLD
 */
export async function getOverrideThreshold(domain: string): Promise<number> {
  await initializeCache();

  const normalizedDomain = domain.toLowerCase();
  const data = thresholdCache.get(normalizedDomain);

  if (!data) {
    return DEFAULT_OVERRIDE_THRESHOLD;
  }

  return data.threshold;
}

/**
 * Synchronous version for hot paths where async is not acceptable.
 * Returns default if cache not initialized.
 */
export function getOverrideThresholdSync(domain: string): number {
  const normalizedDomain = domain.toLowerCase();
  const data = thresholdCache.get(normalizedDomain);
  return data?.threshold ?? DEFAULT_OVERRIDE_THRESHOLD;
}

/**
 * Calculate new threshold based on correction history.
 *
 * Formula: threshold = base × (1 - error_rate) + MIN × error_rate
 * This blends between base threshold and min threshold based on error rate.
 *
 * @param correctionCount - Number of user corrections
 * @param classificationCount - Total classifications for domain
 * @returns Calibrated threshold
 */
export function calculateThreshold(
  correctionCount: number,
  classificationCount: number
): number {
  // Not enough samples for calibration
  if (classificationCount < MIN_SAMPLES_FOR_CALIBRATION) {
    return DEFAULT_OVERRIDE_THRESHOLD;
  }

  // Calculate error rate
  const errorRate = correctionCount / classificationCount;

  // Blend between default and minimum based on error rate
  // High error rate → lower threshold (trust learned more)
  // Low error rate → higher threshold (trust static more)
  const threshold =
    DEFAULT_OVERRIDE_THRESHOLD * (1 - errorRate) +
    MIN_OVERRIDE_THRESHOLD * errorRate;

  // Clamp to valid range
  return Math.max(
    MIN_OVERRIDE_THRESHOLD,
    Math.min(MAX_OVERRIDE_THRESHOLD, threshold)
  );
}

/**
 * Record a correct classification (no user correction).
 *
 * @param domain - Domain that was correctly classified
 */
export async function recordCorrectClassification(
  domain: string
): Promise<void> {
  await initializeCache();

  const normalizedDomain = domain.toLowerCase();
  const existing = thresholdCache.get(normalizedDomain) ?? {
    domain: normalizedDomain,
    threshold: DEFAULT_OVERRIDE_THRESHOLD,
    correctionCount: 0,
    classificationCount: 0,
    accuracy: 1,
    updatedAt: new Date(),
  };

  const updated: DomainThresholdData = {
    ...existing,
    classificationCount: existing.classificationCount + 1,
    accuracy:
      (existing.classificationCount - existing.correctionCount + 1) /
      (existing.classificationCount + 1),
    threshold: calculateThreshold(
      existing.correctionCount,
      existing.classificationCount + 1
    ),
    updatedAt: new Date(),
  };

  thresholdCache.set(normalizedDomain, updated);

  // Persist asynchronously
  if (persistence) {
    persistence.save(updated).catch((_err) => {});
  }
}

/**
 * Record a user correction (classification was wrong).
 *
 * @param domain - Domain that was incorrectly classified
 * @param wasCorrect - Whether the original classification was correct
 */
export async function recordCorrection(
  domain: string,
  wasCorrect: boolean
): Promise<void> {
  await initializeCache();

  const normalizedDomain = domain.toLowerCase();
  const existing = thresholdCache.get(normalizedDomain) ?? {
    domain: normalizedDomain,
    threshold: DEFAULT_OVERRIDE_THRESHOLD,
    correctionCount: 0,
    classificationCount: 0,
    accuracy: 1,
    updatedAt: new Date(),
  };

  const newCorrectionCount = wasCorrect
    ? existing.correctionCount
    : existing.correctionCount + 1;
  const newClassificationCount = existing.classificationCount + 1;

  const updated: DomainThresholdData = {
    ...existing,
    correctionCount: newCorrectionCount,
    classificationCount: newClassificationCount,
    accuracy:
      (newClassificationCount - newCorrectionCount) / newClassificationCount,
    threshold: calculateThreshold(newCorrectionCount, newClassificationCount),
    updatedAt: new Date(),
  };

  thresholdCache.set(normalizedDomain, updated);

  // Persist asynchronously
  if (persistence) {
    persistence.save(updated).catch((_err) => {});
  }
}

/**
 * Bulk calibrate thresholds from correction history.
 * Used for initial setup or recalibration.
 *
 * @param corrections - Array of correction records
 */
export async function calibrateThresholds(
  corrections: Array<{
    domain: string;
    wasCorrect: boolean;
    timestamp?: Date;
  }>
): Promise<Map<string, DomainThresholdData>> {
  // Group corrections by domain
  const byDomain = new Map<string, { correct: number; incorrect: number }>();

  for (const correction of corrections) {
    const domain = correction.domain.toLowerCase();
    const existing = byDomain.get(domain) ?? { correct: 0, incorrect: 0 };
    if (correction.wasCorrect) {
      existing.correct++;
    } else {
      existing.incorrect++;
    }
    byDomain.set(domain, existing);
  }

  // Calculate thresholds
  const results = new Map<string, DomainThresholdData>();

  for (const [domain, counts] of byDomain.entries()) {
    const total = counts.correct + counts.incorrect;
    const threshold = calculateThreshold(counts.incorrect, total);

    const data: DomainThresholdData = {
      domain,
      threshold,
      correctionCount: counts.incorrect,
      classificationCount: total,
      accuracy: counts.correct / total,
      updatedAt: new Date(),
    };

    results.set(domain, data);
    thresholdCache.set(domain, data);
  }

  // Persist all updates
  if (persistence) {
    for (const data of results.values()) {
      persistence.save(data).catch((_err) => {});
    }
  }

  return results;
}

/**
 * Get all cached threshold data (for debugging/monitoring)
 */
export function getAllThresholds(): DomainThresholdData[] {
  return Array.from(thresholdCache.values());
}

/**
 * Clear threshold cache (for testing)
 */
export function clearThresholdCache(): void {
  thresholdCache.clear();
  cacheInitialized = false;
}

/**
 * Get threshold stats for a domain
 */
export async function getThresholdStats(
  domain: string
): Promise<DomainThresholdData | null> {
  await initializeCache();
  return thresholdCache.get(domain.toLowerCase()) ?? null;
}
