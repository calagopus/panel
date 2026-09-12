CREATE TABLE "system_backup_policy_database_agent_hosts" (
	"system_backup_policy_uuid" uuid,
	"database_agent_host_uuid" uuid,
	"created" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_backup_policy_database_agent_hosts_pk" PRIMARY KEY("system_backup_policy_uuid","database_agent_host_uuid")
);

ALTER TABLE "system_backup_policies" ADD COLUMN "kind" "server_backup_kind" DEFAULT 'SERVER'::"server_backup_kind" NOT NULL;
CREATE INDEX "system_backup_policy_database_agent_hosts_system_backup_policy_uuid_idx" ON "system_backup_policy_database_agent_hosts" ("system_backup_policy_uuid");
CREATE INDEX "system_backup_policy_database_agent_hosts_database_agent_host_uuid_idx" ON "system_backup_policy_database_agent_hosts" ("database_agent_host_uuid");
ALTER TABLE "system_backup_policy_database_agent_hosts" ADD CONSTRAINT "system_backup_policy_database_agent_hosts_7OZ84OhrveX7_fkey" FOREIGN KEY ("system_backup_policy_uuid") REFERENCES "system_backup_policies"("uuid") ON DELETE CASCADE;
ALTER TABLE "system_backup_policy_database_agent_hosts" ADD CONSTRAINT "system_backup_policy_database_agent_hosts_FW1iFSlWwxb4_fkey" FOREIGN KEY ("database_agent_host_uuid") REFERENCES "database_agent_hosts"("uuid") ON DELETE CASCADE;