ALTER TABLE "database_agent_hosts" ADD COLUMN "backup_configuration_uuid" uuid;
CREATE INDEX "database_agent_hosts_backup_configuration_uuid_idx" ON "database_agent_hosts" ("backup_configuration_uuid");
ALTER TABLE "database_agent_hosts" ADD CONSTRAINT "database_agent_hosts_FCC43ncVhQU8_fkey" FOREIGN KEY ("backup_configuration_uuid") REFERENCES "backup_configurations"("uuid") ON DELETE SET NULL;