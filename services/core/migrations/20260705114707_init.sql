-- Create "posts" table
CREATE TABLE "posts" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "content_json" jsonb NOT NULL DEFAULT '{}',
  "content_html" text NOT NULL DEFAULT '',
  "excerpt" text NULL,
  "cover_image" text NULL,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "meta_title" text NULL,
  "meta_desc" text NULL,
  "published_at" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "posts_status_check" CHECK (status = ANY (ARRAY['DRAFT'::text, 'PENDING_APPROVAL'::text, 'PUBLISHED'::text]))
);
-- Create index "idx_posts_published_at" to table: "posts"
CREATE INDEX "idx_posts_published_at" ON "posts" ("published_at");
-- Create index "idx_posts_slug" to table: "posts"
CREATE UNIQUE INDEX "idx_posts_slug" ON "posts" ("slug");
-- Create index "idx_posts_status" to table: "posts"
CREATE INDEX "idx_posts_status" ON "posts" ("status");
-- Create "tags" table
CREATE TABLE "tags" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "slug" text NOT NULL,
  PRIMARY KEY ("id")
);
-- Create index "idx_tags_name" to table: "tags"
CREATE UNIQUE INDEX "idx_tags_name" ON "tags" ("name");
-- Create index "idx_tags_slug" to table: "tags"
CREATE UNIQUE INDEX "idx_tags_slug" ON "tags" ("slug");
-- Create "post_tags" table
CREATE TABLE "post_tags" (
  "post_id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "tag_id" uuid NOT NULL DEFAULT gen_random_uuid(),
  PRIMARY KEY ("post_id", "tag_id"),
  CONSTRAINT "fk_post_tags_gorm_post" FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "fk_post_tags_gorm_tag" FOREIGN KEY ("tag_id") REFERENCES "tags" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
