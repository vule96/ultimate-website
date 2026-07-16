-- Modify "posts" table
ALTER TABLE "posts" ADD COLUMN "cover_blurhash" text NULL, ADD COLUMN "views" bigint NOT NULL DEFAULT 0;
