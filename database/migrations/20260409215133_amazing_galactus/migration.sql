ALTER TYPE "database_type" ADD VALUE IF NOT EXISTS 'MONGODB';

ALTER TABLE "database_hosts" ADD COLUMN "credentials" jsonb;

UPDATE "database_hosts"
SET "credentials" = jsonb_build_object(
    'type', 'details',
    'host', host,
    'port', port,
    'username', username,
    'password', replace(encode(password, 'base64'), '\n', '')
);

ALTER TABLE "database_hosts" ALTER COLUMN "credentials" SET NOT NULL;

DROP INDEX IF EXISTS "database_hosts_host_port_idx";
ALTER TABLE "database_hosts" DROP COLUMN "host";
ALTER TABLE "database_hosts" DROP COLUMN "port";
ALTER TABLE "database_hosts" DROP COLUMN "username";
ALTER TABLE "database_hosts" DROP COLUMN "password";