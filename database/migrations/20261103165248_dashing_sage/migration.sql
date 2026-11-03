CREATE TABLE "node_permission_invalidations" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"node_uuid" uuid NOT NULL,
	"as_of" bigint NOT NULL,
	"users" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"servers" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"all_servers" boolean DEFAULT false NOT NULL,
	"revoke_users" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"revoke_credentials" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt" timestamp DEFAULT now() NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "node_permission_invalidations_node_uuid_idx" ON "node_permission_invalidations" ("node_uuid");
CREATE INDEX "node_permission_invalidations_next_attempt_idx" ON "node_permission_invalidations" ("next_attempt");
CREATE UNIQUE INDEX "node_permission_invalidations_node_uuid_pending_idx" ON "node_permission_invalidations" ("node_uuid") WHERE cardinality("revoke_users") = 0 AND cardinality("revoke_credentials") = 0;
ALTER TABLE "node_permission_invalidations" ADD CONSTRAINT "node_permission_invalidations_node_uuid_nodes_uuid_fkey" FOREIGN KEY ("node_uuid") REFERENCES "nodes"("uuid") ON DELETE CASCADE;