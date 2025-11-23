CREATE TABLE IF NOT EXISTS "cognitive_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cognitive_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" varchar(255) NOT NULL,
	"state" jsonb NOT NULL,
	"last_event_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cognitive_events_stream_idx" ON "cognitive_events" ("stream_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cognitive_events_created_idx" ON "cognitive_events" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cognitive_events_stream_created_idx" ON "cognitive_events" ("stream_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cognitive_snapshots_stream_idx" ON "cognitive_snapshots" ("stream_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cognitive_snapshots_created_idx" ON "cognitive_snapshots" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cognitive_snapshots_stream_created_idx" ON "cognitive_snapshots" ("stream_id","created_at");
