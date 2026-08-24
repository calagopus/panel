CREATE TABLE "user_settings" (
	"user_uuid" uuid PRIMARY KEY,
	"settings" jsonb NOT NULL
);

ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_uuid_users_uuid_fkey" FOREIGN KEY ("user_uuid") REFERENCES "users"("uuid") ON DELETE CASCADE;