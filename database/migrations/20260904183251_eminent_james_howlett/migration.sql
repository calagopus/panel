CREATE TYPE "server_backup_kind" AS ENUM('SERVER', 'DATABASE_INSTANCE');
CREATE TYPE "server_database_instance_status" AS ENUM('RESTORING_BACKUP');
ALTER TABLE "server_backups" ADD COLUMN "database_instance_uuid" uuid;
ALTER TABLE "server_backups" ADD COLUMN "database_engine" "database_agent_type";
ALTER TABLE "server_backups" ADD COLUMN "kind" "server_backup_kind" DEFAULT 'SERVER'::"server_backup_kind" NOT NULL;
ALTER TABLE "server_database_instances" ADD COLUMN "status" "server_database_instance_status";
CREATE INDEX "server_backups_database_instance_uuid_idx" ON "server_backups" ("database_instance_uuid");
ALTER TABLE "server_backups" ADD CONSTRAINT "server_backups_lRVXyMeWYfds_fkey" FOREIGN KEY ("database_instance_uuid") REFERENCES "server_database_instances"("uuid") ON DELETE SET NULL;
ALTER TABLE "server_backups" ADD CONSTRAINT "server_backups_kind_database_engine_check" CHECK (("kind" = 'SERVER') = ("database_engine" IS NULL));