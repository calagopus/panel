ALTER TYPE "announcement_type" ADD VALUE 'SUCCESS' BEFORE 'WARNING';
ALTER TABLE "announcements" ADD COLUMN "eggs" uuid[] DEFAULT '{}'::uuid[] NOT NULL;