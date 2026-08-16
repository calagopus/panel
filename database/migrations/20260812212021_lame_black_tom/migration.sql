CREATE TABLE "system_backup_policies" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"backup_configuration_uuid" uuid,
	"name" varchar(1020) NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"cron" varchar(255) NOT NULL,
	"retention_count" integer,
	"retention_days" integer,
	"parallelism" integer DEFAULT 2 NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "system_backup_policy_locations" (
	"system_backup_policy_uuid" uuid,
	"location_uuid" uuid,
	"created" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_backup_policy_locations_pk" PRIMARY KEY("system_backup_policy_uuid","location_uuid")
);

CREATE TABLE "system_backup_policy_nodes" (
	"system_backup_policy_uuid" uuid,
	"node_uuid" uuid,
	"created" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_backup_policy_nodes_pk" PRIMARY KEY("system_backup_policy_uuid","node_uuid")
);

CREATE TABLE "system_backup_policy_servers" (
	"system_backup_policy_uuid" uuid,
	"server_uuid" uuid,
	"created" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_backup_policy_servers_pk" PRIMARY KEY("system_backup_policy_uuid","server_uuid")
);

ALTER TABLE "server_backups" ADD COLUMN "system_backup_policy_uuid" uuid;
CREATE INDEX "server_backups_system_backup_policy_uuid_idx" ON "server_backups" ("system_backup_policy_uuid");
CREATE INDEX "system_backup_policies_backup_configuration_uuid_idx" ON "system_backup_policies" ("backup_configuration_uuid");
CREATE UNIQUE INDEX "system_backup_policies_name_idx" ON "system_backup_policies" ("name");
CREATE INDEX "system_backup_policy_locations_system_backup_policy_uuid_idx" ON "system_backup_policy_locations" ("system_backup_policy_uuid");
CREATE INDEX "system_backup_policy_locations_location_uuid_idx" ON "system_backup_policy_locations" ("location_uuid");
CREATE INDEX "system_backup_policy_nodes_system_backup_policy_uuid_idx" ON "system_backup_policy_nodes" ("system_backup_policy_uuid");
CREATE INDEX "system_backup_policy_nodes_node_uuid_idx" ON "system_backup_policy_nodes" ("node_uuid");
CREATE INDEX "system_backup_policy_servers_system_backup_policy_uuid_idx" ON "system_backup_policy_servers" ("system_backup_policy_uuid");
CREATE INDEX "system_backup_policy_servers_server_uuid_idx" ON "system_backup_policy_servers" ("server_uuid");
ALTER TABLE "server_backups" ADD CONSTRAINT "server_backups_qw8onmvXouZz_fkey" FOREIGN KEY ("system_backup_policy_uuid") REFERENCES "system_backup_policies"("uuid") ON DELETE SET NULL;
ALTER TABLE "system_backup_policies" ADD CONSTRAINT "system_backup_policies_am1hHek55NWa_fkey" FOREIGN KEY ("backup_configuration_uuid") REFERENCES "backup_configurations"("uuid") ON DELETE SET NULL;
ALTER TABLE "system_backup_policy_locations" ADD CONSTRAINT "system_backup_policy_locations_dtv75cUHyG9Y_fkey" FOREIGN KEY ("system_backup_policy_uuid") REFERENCES "system_backup_policies"("uuid") ON DELETE CASCADE;
ALTER TABLE "system_backup_policy_locations" ADD CONSTRAINT "system_backup_policy_locations_Q3jivLygTyQJ_fkey" FOREIGN KEY ("location_uuid") REFERENCES "locations"("uuid") ON DELETE CASCADE;
ALTER TABLE "system_backup_policy_nodes" ADD CONSTRAINT "system_backup_policy_nodes_eeIo1WFYlzef_fkey" FOREIGN KEY ("system_backup_policy_uuid") REFERENCES "system_backup_policies"("uuid") ON DELETE CASCADE;
ALTER TABLE "system_backup_policy_nodes" ADD CONSTRAINT "system_backup_policy_nodes_node_uuid_nodes_uuid_fkey" FOREIGN KEY ("node_uuid") REFERENCES "nodes"("uuid") ON DELETE CASCADE;
ALTER TABLE "system_backup_policy_servers" ADD CONSTRAINT "system_backup_policy_servers_U8t7K5RE2IEg_fkey" FOREIGN KEY ("system_backup_policy_uuid") REFERENCES "system_backup_policies"("uuid") ON DELETE CASCADE;
ALTER TABLE "system_backup_policy_servers" ADD CONSTRAINT "system_backup_policy_servers_server_uuid_servers_uuid_fkey" FOREIGN KEY ("server_uuid") REFERENCES "servers"("uuid") ON DELETE CASCADE;