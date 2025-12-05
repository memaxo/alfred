/**
 * Concept Drift Monitor
 *
 * Monitors for concept drift across different domains and user behaviors
 * using ADWIN detectors. When drift is detected, triggers callbacks
 * for appropriate system responses.
 *
 * Reference: alfred-memory-review.md - "ADWIN for concept drift detection"
 */

import {
  Adwin,
  type AdwinConfig,
  type AdwinSnapshot,
  type DriftResult,
} from "./adwin";

/**
 * Domain-specific drift detector
 */
type DomainDetector = {
  detector: Adwin;
  domain: string;
  lastDrift: number | null;
  driftHistory: DriftEvent[];
};

/**
 * Drift event for history tracking
 */
export type DriftEvent = {
  domain: string;
  timestamp: number;
  oldMean: number;
  newMean: number;
  windowSizeBefore: number;
  windowSizeAfter: number;
};

/**
 * Drift callback function type
 */
export type DriftCallback = (event: DriftEvent) => void | Promise<void>;

/**
 * Monitor configuration
 */
export type MonitorConfig = {
  /** ADWIN configuration for all detectors */
  adwinConfig?: AdwinConfig;
  /** Maximum drift events to retain in history */
  maxHistorySize?: number;
  /** Callback when drift is detected */
  onDrift?: DriftCallback;
};

/**
 * Monitor snapshot for persistence
 */
export type MonitorSnapshot = {
  detectors: Array<{
    domain: string;
    adwin: AdwinSnapshot;
    lastDrift: number | null;
    driftHistory: DriftEvent[];
  }>;
  globalHistory: DriftEvent[];
};

/**
 * Concept Drift Monitor
 *
 * Tracks multiple domains and detects when user interests or
 * classification accuracy shifts significantly.
 */
export class DriftMonitor {
  private detectors = new Map<string, DomainDetector>();
  private globalHistory: DriftEvent[] = [];

  private readonly adwinConfig: AdwinConfig;
  private readonly maxHistorySize: number;
  private readonly onDrift?: DriftCallback;

  constructor(config: MonitorConfig = {}) {
    this.adwinConfig = config.adwinConfig ?? {};
    this.maxHistorySize = config.maxHistorySize ?? 100;
    this.onDrift = config.onDrift;
  }

  /**
   * Record an observation for a domain.
   * Returns drift detection result.
   *
   * @param domain - Domain being observed
   * @param value - Observation value (e.g., classification accuracy, engagement)
   */
  observe(domain: string, value: number): DriftResult {
    const normalizedDomain = domain.toLowerCase();

    // Get or create detector for domain
    let domainDetector = this.detectors.get(normalizedDomain);
    if (!domainDetector) {
      domainDetector = {
        detector: new Adwin(this.adwinConfig),
        domain: normalizedDomain,
        lastDrift: null,
        driftHistory: [],
      };
      this.detectors.set(normalizedDomain, domainDetector);
    }

    // Get state before observation
    const meanBefore = domainDetector.detector.getMean();
    const windowSizeBefore = domainDetector.detector.getWindowSize();

    // Add observation
    const result = domainDetector.detector.add(value);

    // Handle drift if detected
    if (result.driftDetected) {
      const event: DriftEvent = {
        domain: normalizedDomain,
        timestamp: result.timestamp,
        oldMean: meanBefore,
        newMean: result.mean,
        windowSizeBefore,
        windowSizeAfter: result.windowSize,
      };

      // Update domain history
      domainDetector.lastDrift = result.timestamp;
      domainDetector.driftHistory.push(event);
      if (domainDetector.driftHistory.length > this.maxHistorySize) {
        domainDetector.driftHistory.shift();
      }

      // Update global history
      this.globalHistory.push(event);
      if (this.globalHistory.length > this.maxHistorySize) {
        this.globalHistory.shift();
      }

      // Trigger callback
      if (this.onDrift) {
        // Fire and forget, don't block
        Promise.resolve(this.onDrift(event)).catch((err) => {
          console.warn("Drift callback error:", err);
        });
      }
    }

    return result;
  }

  /**
   * Record a classification accuracy observation.
   * Convenience method that takes correct/incorrect as boolean.
   */
  recordClassification(domain: string, wasCorrect: boolean): DriftResult {
    return this.observe(domain, wasCorrect ? 1 : 0);
  }

  /**
   * Get current statistics for a domain
   */
  getDomainStats(domain: string): {
    mean: number;
    variance: number;
    windowSize: number;
    driftCount: number;
    lastDrift: number | null;
  } | null {
    const detector = this.detectors.get(domain.toLowerCase());
    if (!detector) {
      return null;
    }

    return {
      mean: detector.detector.getMean(),
      variance: detector.detector.getVariance(),
      windowSize: detector.detector.getWindowSize(),
      driftCount: detector.detector.getDriftCount(),
      lastDrift: detector.lastDrift,
    };
  }

  /**
   * Get drift history for a domain
   */
  getDomainHistory(domain: string): DriftEvent[] {
    const detector = this.detectors.get(domain.toLowerCase());
    return detector?.driftHistory ?? [];
  }

  /**
   * Get global drift history across all domains
   */
  getGlobalHistory(): DriftEvent[] {
    return [...this.globalHistory];
  }

  /**
   * Get all monitored domains
   */
  getMonitoredDomains(): string[] {
    return Array.from(this.detectors.keys());
  }

  /**
   * Check if a domain has recently drifted
   */
  hasRecentDrift(domain: string, withinMs: number): boolean {
    const detector = this.detectors.get(domain.toLowerCase());
    if (!detector?.lastDrift) {
      return false;
    }

    return Date.now() - detector.lastDrift < withinMs;
  }

  /**
   * Get domains that have drifted within a time window
   */
  getRecentlyDriftedDomains(withinMs: number): string[] {
    const result: string[] = [];
    const now = Date.now();

    for (const [domain, detector] of this.detectors) {
      if (detector.lastDrift && now - detector.lastDrift < withinMs) {
        result.push(domain);
      }
    }

    return result;
  }

  /**
   * Reset a specific domain's detector
   */
  resetDomain(domain: string): void {
    const detector = this.detectors.get(domain.toLowerCase());
    if (detector) {
      detector.detector.reset();
      detector.lastDrift = null;
      detector.driftHistory = [];
    }
  }

  /**
   * Reset all detectors
   */
  resetAll(): void {
    for (const detector of this.detectors.values()) {
      detector.detector.reset();
      detector.lastDrift = null;
      detector.driftHistory = [];
    }
    this.globalHistory = [];
  }

  /**
   * Export state for persistence
   */
  snapshot(): MonitorSnapshot {
    const detectors: MonitorSnapshot["detectors"] = [];

    for (const [domain, detector] of this.detectors) {
      detectors.push({
        domain,
        adwin: detector.detector.snapshot(),
        lastDrift: detector.lastDrift,
        driftHistory: [...detector.driftHistory],
      });
    }

    return {
      detectors,
      globalHistory: [...this.globalHistory],
    };
  }

  /**
   * Restore state from snapshot
   */
  restore(snapshot: MonitorSnapshot): void {
    this.detectors.clear();

    for (const d of snapshot.detectors) {
      const adwin = new Adwin(this.adwinConfig);
      adwin.restore(d.adwin);

      this.detectors.set(d.domain, {
        detector: adwin,
        domain: d.domain,
        lastDrift: d.lastDrift,
        driftHistory: [...d.driftHistory],
      });
    }

    this.globalHistory = [...snapshot.globalHistory];
  }
}

/**
 * Create a new drift monitor with default configuration
 */
export function createDriftMonitor(config?: MonitorConfig): DriftMonitor {
  return new DriftMonitor(config);
}

/**
 * Singleton monitor instance for global use
 */
let globalMonitor: DriftMonitor | null = null;

/**
 * Get or create the global drift monitor
 */
export function getGlobalDriftMonitor(config?: MonitorConfig): DriftMonitor {
  if (!globalMonitor) {
    globalMonitor = new DriftMonitor(config);
  }
  return globalMonitor;
}

/**
 * Reset the global drift monitor
 */
export function resetGlobalDriftMonitor(): void {
  if (globalMonitor) {
    globalMonitor.resetAll();
  }
  globalMonitor = null;
}
