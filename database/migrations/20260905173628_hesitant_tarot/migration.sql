ALTER TABLE "server_tunnel_connections" DROP CONSTRAINT "server_tunnel_connections_v9hmsXmNskSA_fkey";
DROP INDEX "server_tunnels_name_idx";
ALTER TABLE "server_tunnel_connections" ADD COLUMN "dst_name" varchar(63);
UPDATE "server_tunnel_connections"
SET "dst_name" = "server_tunnels"."name"
FROM "server_tunnels"
WHERE "server_tunnel_connections"."dst_server_uuid" = "server_tunnels"."server_uuid";
ALTER TABLE "server_tunnel_connections" ALTER COLUMN "dst_name" SET NOT NULL;
CREATE UNIQUE INDEX "server_tunnel_connections_src_server_uuid_dst_name_idx" ON "server_tunnel_connections" ("src_server_uuid","dst_name");
CREATE UNIQUE INDEX "server_tunnels_server_uuid_name_idx" ON "server_tunnels" ("server_uuid","name");
ALTER TABLE "server_tunnel_connections" ADD CONSTRAINT "server_tunnel_connections_t52XsvHd0oYa_fkey" FOREIGN KEY ("dst_server_uuid","dst_name") REFERENCES "server_tunnels"("server_uuid","name") ON DELETE CASCADE ON UPDATE CASCADE;
