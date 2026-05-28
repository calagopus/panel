ALTER TABLE "backup_configurations" ADD COLUMN "shared" boolean DEFAULT false NOT NULL;
ALTER TABLE "server_backups" ADD COLUMN "shared" boolean DEFAULT false NOT NULL;

UPDATE "backup_configurations" SET "shared" = true WHERE "backup_configurations"."backup_disk" = 'S3' OR "backup_configurations"."backup_disk" = 'RESTIC';
UPDATE "server_backups" SET "shared" = true WHERE "server_backups"."disk" = 'S3' OR "server_backups"."disk" = 'RESTIC';