CREATE TABLE "server_backup_groups" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"server_uuid" uuid NOT NULL,
	"name" varchar(1020) NOT NULL,
	"retention_count" integer,
	"retention_days" integer,
	"created" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "server_backups" ADD COLUMN "backup_group_uuid" uuid;
CREATE INDEX "server_backup_groups_server_uuid_idx" ON "server_backup_groups" ("server_uuid");
CREATE UNIQUE INDEX "server_backup_groups_server_uuid_name_idx" ON "server_backup_groups" ("server_uuid","name");
CREATE INDEX "server_backups_backup_group_uuid_idx" ON "server_backups" ("backup_group_uuid");
ALTER TABLE "server_backup_groups" ADD CONSTRAINT "server_backup_groups_server_uuid_servers_uuid_fkey" FOREIGN KEY ("server_uuid") REFERENCES "servers"("uuid") ON DELETE CASCADE;
ALTER TABLE "server_backups" ADD CONSTRAINT "server_backups_backup_group_uuid_server_backup_groups_uuid_fkey" FOREIGN KEY ("backup_group_uuid") REFERENCES "server_backup_groups"("uuid") ON DELETE SET NULL;