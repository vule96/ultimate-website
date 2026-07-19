-- Index sắp xếp created_at DESC cho list admin (subscribers/readers) — tránh full sort.
CREATE INDEX IF NOT EXISTS "idx_subscribers_created_at" ON "subscribers" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_readers_created_at" ON "readers" ("created_at" DESC);
