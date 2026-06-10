-- Add optional phone column to User so the registration form can persist it.
-- Nullable so existing rows backfill cleanly without a default.
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
