-- Modify "posts" table
ALTER TABLE "posts" ADD COLUMN "version" bigint NOT NULL DEFAULT 1;
