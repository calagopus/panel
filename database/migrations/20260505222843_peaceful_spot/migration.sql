CREATE TYPE "announcement_type" AS ENUM('INFO', 'WARNING', 'ERROR');
CREATE TABLE "announcements" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"type" "announcement_type" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"enabled_start" timestamp,
	"enabled_end" timestamp,
	"title" varchar(1020) NOT NULL,
	"title_translations" jsonb DEFAULT '{}' NOT NULL,
	"content" text NOT NULL,
	"content_translations" jsonb DEFAULT '{}' NOT NULL,
	"locations" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"nodes" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"backup_configurations" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL
);

UPDATE "settings" SET "key" = 'user:allow_changing_language' WHERE "key" = 'app:language_change_enabled';
