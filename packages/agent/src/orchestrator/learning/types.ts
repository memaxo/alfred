export interface LearningWorkerConfig {
  enabled: boolean;
  decayEnabled: boolean;
  maintenanceIntervalMs: number;
  decayThresholdMs: number;
  decayFactor: number;
  pruneConfidence: number;
  cleanupAgeMs: number;
  decayLimit: number;
  confidenceFloor: number;
}
