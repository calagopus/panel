CREATE TYPE "team_member_management" AS ENUM('MEMBERS', 'PRESETS');
CREATE TABLE "team_activities" (
	"team_uuid" uuid NOT NULL,
	"user_uuid" uuid,
	"impersonator_uuid" uuid,
	"api_key_uuid" uuid,
	"event" varchar(255) NOT NULL,
	"ip" inet,
	"data" jsonb NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "team_members" (
	"team_uuid" uuid,
	"user_uuid" uuid,
	"preset_uuid" uuid NOT NULL,
	"management" "team_member_management"[] DEFAULT '{}'::"team_member_management"[] NOT NULL,
	"inviter_uuid" uuid,
	"accepted" timestamp,
	"created" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_pk" PRIMARY KEY("team_uuid","user_uuid")
);

CREATE TABLE "team_presets" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"team_uuid" uuid NOT NULL,
	"name" varchar(1020) NOT NULL,
	"description" text,
	"weight" integer DEFAULT 0 NOT NULL,
	"permissions" varchar(64)[] NOT NULL,
	"ignored_files" text[] NOT NULL,
	"created" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "teams" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"owner_uuid" uuid NOT NULL,
	"name" varchar(1020) NOT NULL,
	"description" text,
	"created" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "servers" ADD COLUMN "team_uuid" uuid;
CREATE INDEX "servers_team_uuid_idx" ON "servers" ("team_uuid");
CREATE INDEX "team_activities_team_uuid_created_idx" ON "team_activities" ("team_uuid","created");
CREATE INDEX "team_activities_impersonator_uuid_idx" ON "team_activities" ("impersonator_uuid");
CREATE INDEX "team_activities_api_key_uuid_idx" ON "team_activities" ("api_key_uuid");
CREATE INDEX "team_activities_created_idx" ON "team_activities" ("created");
CREATE INDEX "team_activities_user_uuid_created_idx" ON "team_activities" ("user_uuid","created");
CREATE INDEX "team_members_team_uuid_idx" ON "team_members" ("team_uuid");
CREATE INDEX "team_members_user_uuid_idx" ON "team_members" ("user_uuid");
CREATE INDEX "team_members_preset_uuid_idx" ON "team_members" ("preset_uuid");
CREATE INDEX "team_presets_team_uuid_idx" ON "team_presets" ("team_uuid");
CREATE UNIQUE INDEX "team_presets_team_uuid_name_idx" ON "team_presets" ("team_uuid","name");
CREATE INDEX "teams_owner_uuid_idx" ON "teams" ("owner_uuid");
CREATE UNIQUE INDEX "teams_uuid_owner_uuid_idx" ON "teams" ("uuid","owner_uuid");
ALTER TABLE "servers" ADD CONSTRAINT "servers_team_uuid_teams_uuid_fkey" FOREIGN KEY ("team_uuid") REFERENCES "teams"("uuid") ON DELETE SET NULL;
ALTER TABLE "servers" ADD CONSTRAINT "servers_team_uuid_owner_uuid_teams_uuid_owner_uuid_fkey" FOREIGN KEY ("team_uuid","owner_uuid") REFERENCES "teams"("uuid","owner_uuid");
ALTER TABLE "team_activities" ADD CONSTRAINT "team_activities_team_uuid_teams_uuid_fkey" FOREIGN KEY ("team_uuid") REFERENCES "teams"("uuid") ON DELETE CASCADE;
ALTER TABLE "team_activities" ADD CONSTRAINT "team_activities_user_uuid_users_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE SET NULL;
ALTER TABLE "team_activities" ADD CONSTRAINT "team_activities_impersonator_uuid_users_uuid_fkey" FOREIGN KEY ("impersonator_uuid") REFERENCES "users"("uuid") ON DELETE SET NULL;
ALTER TABLE "team_activities" ADD CONSTRAINT "team_activities_api_key_uuid_user_api_keys_uuid_fkey" FOREIGN KEY ("api_key_uuid") REFERENCES "user_api_keys"("uuid") ON DELETE SET NULL;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_uuid_teams_uuid_fkey" FOREIGN KEY ("team_uuid") REFERENCES "teams"("uuid") ON DELETE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_uuid_users_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_preset_uuid_team_presets_uuid_fkey" FOREIGN KEY ("preset_uuid") REFERENCES "team_presets"("uuid");
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_inviter_uuid_users_uuid_fkey" FOREIGN KEY ("inviter_uuid") REFERENCES "users"("uuid") ON DELETE SET NULL;
ALTER TABLE "team_presets" ADD CONSTRAINT "team_presets_team_uuid_teams_uuid_fkey" FOREIGN KEY ("team_uuid") REFERENCES "teams"("uuid") ON DELETE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_uuid_users_uuid_fkey" FOREIGN KEY ("owner_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE;