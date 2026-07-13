CREATE TABLE "server_database_instances" (
	"uuid" uuid PRIMARY KEY,
	"server_uuid" uuid NOT NULL,
	"database_agent_host_uuid" uuid NOT NULL,
	"database_agent_template_uuid" uuid,
	"type" "database_agent_type" NOT NULL,
	"name" varchar(124) NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"memory" bigint NOT NULL,
	"swap" bigint NOT NULL,
	"disk" bigint NOT NULL,
	"io_weight" smallint,
	"cpu" integer NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "database_agent_hosts" ADD COLUMN "types" jsonb DEFAULT '{"postgres":{"enabled":true,"public_host":null,"public_port":null},"mariadb":{"enabled":true,"public_host":null,"public_port":null},"mongodb":{"enabled":true,"public_host":null,"public_port":null},"redis":{"enabled":true,"public_host":null,"public_port":null}}' NOT NULL;
CREATE INDEX "server_database_instances_server_uuid_idx" ON "server_database_instances" ("server_uuid");
CREATE INDEX "server_database_instances_database_agent_host_uuid_idx" ON "server_database_instances" ("database_agent_host_uuid");
CREATE UNIQUE INDEX "server_database_instances_server_uuid_name_idx" ON "server_database_instances" ("server_uuid","name");
ALTER TABLE "server_database_instances" ADD CONSTRAINT "server_database_instances_server_uuid_servers_uuid_fkey" FOREIGN KEY ("server_uuid") REFERENCES "servers"("uuid");
ALTER TABLE "server_database_instances" ADD CONSTRAINT "server_database_instances_Lh0pHy5XWXNR_fkey" FOREIGN KEY ("database_agent_host_uuid") REFERENCES "database_agent_hosts"("uuid");
ALTER TABLE "server_database_instances" ADD CONSTRAINT "server_database_instances_72i2wDSElEj1_fkey" FOREIGN KEY ("database_agent_template_uuid") REFERENCES "database_agent_templates"("uuid") ON DELETE SET NULL;