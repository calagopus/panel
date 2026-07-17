ALTER TABLE "server_backups" ADD COLUMN "deleting" timestamp;
ALTER TABLE "server_backups" ADD COLUMN "deletion_retries" integer DEFAULT 0 NOT NULL;