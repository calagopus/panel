CREATE TABLE "oauth_provider_mappings" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"oauth_provider_uuid" uuid NOT NULL,
	"scopes" varchar(255)[] NOT NULL,
	"mapping" jsonb NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "oauth_provider_mappings_oauth_provider_uuid_idx" ON "oauth_provider_mappings" ("oauth_provider_uuid");
ALTER TABLE "oauth_provider_mappings" ADD CONSTRAINT "oauth_provider_mappings_k0PKNzI1DJWO_fkey" FOREIGN KEY ("oauth_provider_uuid") REFERENCES "oauth_providers"("uuid") ON DELETE CASCADE;

UPDATE "settings" SET "key" = 'mail_smtp_tls_mode', "value" = 'start_tls' WHERE "key" = 'mail_smtp_use_tls' AND "value" = 'true';