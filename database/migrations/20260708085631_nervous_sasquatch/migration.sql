CREATE TYPE "database_agent_type" AS ENUM('POSTGRES', 'MARIADB', 'MONGODB', 'REDIS');
CREATE TABLE "database_agent_hosts" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(1020) NOT NULL,
	"description" text,
	"deployment_enabled" boolean DEFAULT false NOT NULL,
	"maintenance_enabled" boolean DEFAULT false NOT NULL,
	"url" varchar(1020) NOT NULL,
	"memory" bigint NOT NULL,
	"disk" bigint NOT NULL,
	"token" bytea NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "database_agent_templates" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(1020) NOT NULL,
	"description" text,
	"type" "database_agent_type" NOT NULL,
	"deployment_enabled" boolean DEFAULT false NOT NULL,
	"docker_images" json NOT NULL,
	"env" json NOT NULL,
	"image_uid" integer NOT NULL,
	"image_gid" integer NOT NULL,
	"cmd" text[],
	"volumes" json NOT NULL,
	"memory" bigint NOT NULL,
	"swap" bigint NOT NULL,
	"disk" bigint NOT NULL,
	"io_weight" smallint,
	"cpu" integer NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "location_database_agent_hosts" (
	"location_uuid" uuid,
	"database_agent_host_uuid" uuid,
	"created" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "location_database_agent_hosts_pk" PRIMARY KEY("location_uuid","database_agent_host_uuid")
);

CREATE UNIQUE INDEX "database_agent_hosts_name_idx" ON "database_agent_hosts" ("name");
CREATE UNIQUE INDEX "database_agent_hosts_token_idx" ON "database_agent_hosts" ("token");
CREATE UNIQUE INDEX "database_agent_templates_name_idx" ON "database_agent_templates" ("name");
CREATE INDEX "location_database_agent_hosts_location_uuid_idx" ON "location_database_agent_hosts" ("location_uuid");
CREATE INDEX "location_database_agent_hosts_database_agent_host_uuid_idx" ON "location_database_agent_hosts" ("database_agent_host_uuid");
ALTER TABLE "location_database_agent_hosts" ADD CONSTRAINT "location_database_agent_hosts_location_uuid_locations_uuid_fkey" FOREIGN KEY ("location_uuid") REFERENCES "locations"("uuid") ON DELETE CASCADE;
ALTER TABLE "location_database_agent_hosts" ADD CONSTRAINT "location_database_agent_hosts_cIKhOHNACVbM_fkey" FOREIGN KEY ("database_agent_host_uuid") REFERENCES "database_agent_hosts"("uuid") ON DELETE CASCADE;