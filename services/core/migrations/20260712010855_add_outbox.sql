-- Create "outbox" table
CREATE TABLE "outbox" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "aggregate" text NOT NULL,
  "aggregate_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "processed_at" timestamptz NULL,
  PRIMARY KEY ("id")
);
-- Create index "idx_outbox_unprocessed" to table: "outbox"
CREATE INDEX "idx_outbox_unprocessed" ON "outbox" ("created_at") WHERE (processed_at IS NULL);
