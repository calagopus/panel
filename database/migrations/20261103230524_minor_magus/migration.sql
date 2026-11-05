CREATE TYPE "system_backup_policy_run_target_reason" AS ENUM('NODE_MAINTENANCE', 'BACKUP_CONFIGURATION_MAINTENANCE', 'DATABASE_AGENT_HOST_MAINTENANCE', 'DATABASE_INSTANCE_STOPPED', 'SERVER_BUSY', 'METADATA_FAILED', 'NO_BACKUP_CONFIGURATION', 'UNSUPPORTED_BACKUP_DISK', 'TARGET_REMOVED', 'CREATE_FAILED', 'POLICY_DISABLED', 'SUPERSEDED', 'CANCELLED');
CREATE TYPE "system_backup_policy_run_target_status" AS ENUM('PENDING', 'DISPATCHED', 'SKIPPED', 'FAILED');
CREATE TABLE "system_backup_policy_run_targets" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"system_backup_policy_run_uuid" uuid NOT NULL,
	"server_uuid" uuid,
	"database_instance_uuid" uuid,
	"server_backup_uuid" uuid,
	"status" "system_backup_policy_run_target_status" DEFAULT 'PENDING'::"system_backup_policy_run_target_status" NOT NULL,
	"reason" "system_backup_policy_run_target_reason",
	"last_attempt" timestamp,
	"not_before" timestamp,
	"updated" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "system_backup_policy_runs" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"system_backup_policy_uuid" uuid NOT NULL,
	"manual" boolean NOT NULL,
	"occurrence" timestamp NOT NULL,
	"total_targets" integer DEFAULT 0 NOT NULL,
	"successful_targets" integer DEFAULT 0 NOT NULL,
	"failed_targets" integer DEFAULT 0 NOT NULL,
	"skipped_targets" integer DEFAULT 0 NOT NULL,
	"cancelled" timestamp,
	"completed" timestamp,
	"created" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "system_backup_policies" DROP COLUMN "triggered";
CREATE INDEX "server_backups_policy_uuid_server_uuid_created_idx" ON "server_backups" ("system_backup_policy_uuid","server_uuid","created") WHERE "system_backup_policy_uuid" IS NOT NULL;
CREATE INDEX "server_backups_policy_uuid_database_instance_uuid_created_idx" ON "server_backups" ("system_backup_policy_uuid","database_instance_uuid","created") WHERE "system_backup_policy_uuid" IS NOT NULL AND "database_instance_uuid" IS NOT NULL;
CREATE INDEX "system_backup_policy_run_targets_run_uuid_idx" ON "system_backup_policy_run_targets" ("system_backup_policy_run_uuid");
CREATE INDEX "system_backup_policy_run_targets_run_uuid_pending_idx" ON "system_backup_policy_run_targets" ("system_backup_policy_run_uuid") WHERE "status" = 'PENDING';
CREATE INDEX "system_backup_policy_run_targets_server_uuid_idx" ON "system_backup_policy_run_targets" ("server_uuid");
CREATE INDEX "system_backup_policy_run_targets_database_instance_uuid_idx" ON "system_backup_policy_run_targets" ("database_instance_uuid");
CREATE INDEX "system_backup_policy_run_targets_server_backup_uuid_idx" ON "system_backup_policy_run_targets" ("server_backup_uuid");
CREATE INDEX "system_backup_policy_runs_policy_uuid_created_idx" ON "system_backup_policy_runs" ("system_backup_policy_uuid","created");
CREATE UNIQUE INDEX "system_backup_policy_runs_policy_uuid_occurrence_idx" ON "system_backup_policy_runs" ("system_backup_policy_uuid","occurrence") WHERE NOT "manual";
CREATE INDEX "system_backup_policy_runs_policy_uuid_open_idx" ON "system_backup_policy_runs" ("system_backup_policy_uuid") WHERE "completed" IS NULL;
ALTER TABLE "system_backup_policy_run_targets" ADD CONSTRAINT "system_backup_policy_run_targets_J4jCMzIVLIRZ_fkey" FOREIGN KEY ("system_backup_policy_run_uuid") REFERENCES "system_backup_policy_runs"("uuid") ON DELETE CASCADE;
ALTER TABLE "system_backup_policy_run_targets" ADD CONSTRAINT "system_backup_policy_run_targets_server_uuid_servers_uuid_fkey" FOREIGN KEY ("server_uuid") REFERENCES "servers"("uuid") ON DELETE SET NULL;
ALTER TABLE "system_backup_policy_run_targets" ADD CONSTRAINT "system_backup_policy_run_targets_OitbAt1mBZSR_fkey" FOREIGN KEY ("database_instance_uuid") REFERENCES "server_database_instances"("uuid") ON DELETE SET NULL;
ALTER TABLE "system_backup_policy_run_targets" ADD CONSTRAINT "system_backup_policy_run_targets_k1j9dlT82L25_fkey" FOREIGN KEY ("server_backup_uuid") REFERENCES "server_backups"("uuid") ON DELETE SET NULL;
ALTER TABLE "system_backup_policy_runs" ADD CONSTRAINT "system_backup_policy_runs_fXpo50O7NZcS_fkey" FOREIGN KEY ("system_backup_policy_uuid") REFERENCES "system_backup_policies"("uuid") ON DELETE CASCADE;