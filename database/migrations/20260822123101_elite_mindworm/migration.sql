CREATE TABLE "user_email_verifications" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_uuid" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"token_start" char(16) NOT NULL,
	"token" text NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "user_two_factor_codes" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_uuid" uuid NOT NULL,
	"code" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "users" ADD COLUMN "email_two_factor_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;
UPDATE "users" SET "email_verified" = true;
CREATE INDEX "user_email_verifications_user_uuid_idx" ON "user_email_verifications" ("user_uuid");
CREATE UNIQUE INDEX "user_email_verifications_token_idx" ON "user_email_verifications" ("token");
CREATE INDEX "user_email_verifications_token_start_idx" ON "user_email_verifications" ("token_start");
CREATE INDEX "user_two_factor_codes_user_uuid_idx" ON "user_two_factor_codes" ("user_uuid");
ALTER TABLE "user_email_verifications" ADD CONSTRAINT "user_email_verifications_user_uuid_users_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE;
ALTER TABLE "user_two_factor_codes" ADD CONSTRAINT "user_two_factor_codes_user_uuid_users_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE;