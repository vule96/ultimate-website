-- Enable citext cho subscribers.email (unique không phân biệt hoa/thường)
CREATE EXTENSION IF NOT EXISTS citext;
-- Create "bookmarks" table
CREATE TABLE "bookmarks" (
  "reader_id" uuid NOT NULL,
  "post_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("reader_id", "post_id")
);
-- Create "readers" table
CREATE TABLE "readers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "google_sub" text NOT NULL,
  "email" text NOT NULL,
  "name" text NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
-- Create index "idx_readers_google_sub" to table: "readers"
CREATE UNIQUE INDEX "idx_readers_google_sub" ON "readers" ("google_sub");
-- Add FK cascade cho bookmarks (reader/post bị xoá → bookmark liên quan tự xoá)
ALTER TABLE "bookmarks" ADD CONSTRAINT "fk_bookmarks_reader"
  FOREIGN KEY ("reader_id") REFERENCES "readers" ("id") ON DELETE CASCADE;
ALTER TABLE "bookmarks" ADD CONSTRAINT "fk_bookmarks_post"
  FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE CASCADE;
-- Create "subscribers" table
CREATE TABLE "subscribers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "email" citext NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
-- Create index "idx_subscribers_email" to table: "subscribers"
CREATE UNIQUE INDEX "idx_subscribers_email" ON "subscribers" ("email");
