CREATE TABLE "server_firewalls" (
	"server_uuid" uuid PRIMARY KEY,
	"rules" jsonb NOT NULL
);

ALTER TABLE "server_firewalls" ADD CONSTRAINT "server_firewalls_server_uuid_servers_uuid_fkey" FOREIGN KEY ("server_uuid") REFERENCES "servers"("uuid") ON DELETE CASCADE;