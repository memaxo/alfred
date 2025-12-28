-- Add lamport column for cross-run ordering
ALTER TABLE workflow_events ADD COLUMN IF NOT EXISTS lamport bigint;
ALTER TABLE cognitive_events ADD COLUMN IF NOT EXISTS lamport bigint;

CREATE INDEX IF NOT EXISTS workflow_events_lamport_idx ON workflow_events (lamport);
CREATE INDEX IF NOT EXISTS cognitive_events_lamport_idx ON cognitive_events (lamport);
