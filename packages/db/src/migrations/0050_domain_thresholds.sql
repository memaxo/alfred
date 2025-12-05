-- Migration 0050: Add domain threshold calibration table
-- Purpose: Store per-domain override thresholds that calibrate based on user corrections
-- Reference: alfred-memory-review.md - "Domain-adaptive thresholds improve accuracy"
--
-- Formula: threshold = base_threshold × (1 - error_rate)
-- Where error_rate = corrections / total_classifications

CREATE TABLE IF NOT EXISTS domain_thresholds (
  domain text PRIMARY KEY,
  threshold numeric(4,3) NOT NULL DEFAULT 0.8,
  correction_count integer NOT NULL DEFAULT 0,
  classification_count integer NOT NULL DEFAULT 0,
  accuracy numeric(5,4),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Index for finding domains with high error rates (for monitoring)
CREATE INDEX IF NOT EXISTS domain_thresholds_accuracy_idx
  ON domain_thresholds (accuracy)
  WHERE classification_count >= 10;

-- Comment explaining the table
COMMENT ON TABLE domain_thresholds IS
  'Per-domain override thresholds that calibrate based on user correction history. Higher error rates result in lower thresholds (more trust in learned knowledge).';

COMMENT ON COLUMN domain_thresholds.threshold IS
  'Current calibrated threshold. Learned knowledge above this confidence overrides static. Formula: base × (1 - error_rate) + min × error_rate';

COMMENT ON COLUMN domain_thresholds.accuracy IS
  'Classification accuracy = (total - corrections) / total. NULL until MIN_SAMPLES_FOR_CALIBRATION reached.';
