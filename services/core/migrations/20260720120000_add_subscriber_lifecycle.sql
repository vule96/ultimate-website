-- Subscriber lifecycle: token huỷ đăng ký (3.1 unsubscribe) + soft-delete audit (3.5).
-- Add column "unsubscribe_token" to table: "subscribers"
ALTER TABLE "subscribers" ADD COLUMN "unsubscribe_token" uuid NOT NULL DEFAULT gen_random_uuid();
-- Add column "deleted_at" to table: "subscribers"
ALTER TABLE "subscribers" ADD COLUMN "deleted_at" timestamptz NULL;
-- Create index "idx_subscribers_unsub_token" to table: "subscribers"
CREATE UNIQUE INDEX "idx_subscribers_unsub_token" ON "subscribers" ("unsubscribe_token");
