ALTER TABLE "announcements" ADD COLUMN "dismissible" boolean DEFAULT false NOT NULL;
ALTER TABLE "announcements" ADD COLUMN "dismissible_end" timestamp;