-- Create "sessions" table
CREATE TABLE "sessions" (
  "token" text NOT NULL,
  "data" bytea NOT NULL,
  "expiry" timestamptz NOT NULL,
  PRIMARY KEY ("token")
);
-- Create index "idx_sessions_expiry" to table: "sessions"
CREATE INDEX "idx_sessions_expiry" ON "sessions" ("expiry");
