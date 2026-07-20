ALTER TABLE "database_agent_templates" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
ALTER TABLE "server_database_instances" ADD COLUMN "template_version" integer;
ALTER TABLE "server_database_instances" ADD COLUMN "image" text;
ALTER TABLE "server_database_instances" ADD COLUMN "env" json;
ALTER TABLE "server_database_instances" ALTER COLUMN "memory" DROP NOT NULL;
ALTER TABLE "server_database_instances" ALTER COLUMN "swap" DROP NOT NULL;
ALTER TABLE "server_database_instances" ALTER COLUMN "disk" DROP NOT NULL;
ALTER TABLE "server_database_instances" ALTER COLUMN "cpu" DROP NOT NULL;
UPDATE "server_database_instances" SET "template_version" = 1 WHERE "database_agent_template_uuid" IS NOT NULL;
UPDATE "server_database_instances" sdi SET
  "memory" = CASE WHEN sdi."memory" = t."memory" THEN NULL ELSE sdi."memory" END,
  "swap" = CASE WHEN sdi."swap" = t."swap" THEN NULL ELSE sdi."swap" END,
  "disk" = CASE WHEN sdi."disk" = t."disk" THEN NULL ELSE sdi."disk" END,
  "io_weight" = CASE WHEN sdi."io_weight" IS NOT DISTINCT FROM t."io_weight" THEN NULL ELSE sdi."io_weight" END,
  "cpu" = CASE WHEN sdi."cpu" = t."cpu" THEN NULL ELSE sdi."cpu" END
FROM "database_agent_templates" t
WHERE sdi."database_agent_template_uuid" = t."uuid";