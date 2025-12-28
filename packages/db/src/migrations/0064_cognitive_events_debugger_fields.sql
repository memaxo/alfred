-- Add parentId and seq to cognitive_events
ALTER TABLE cognitive_events ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES cognitive_events(id);
ALTER TABLE cognitive_events ADD COLUMN IF NOT EXISTS seq integer;
CREATE INDEX IF NOT EXISTS cognitive_events_stream_seq_idx ON cognitive_events (stream_id, seq);
CREATE INDEX IF NOT EXISTS cognitive_events_parent_id_idx ON cognitive_events (parent_id);
