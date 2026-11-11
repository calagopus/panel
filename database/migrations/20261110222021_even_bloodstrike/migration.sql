DROP INDEX "command_snippets_eggs_idx";
ALTER TABLE "user_command_snippets" ADD COLUMN "matcher" jsonb;
UPDATE "user_command_snippets" SET "matcher" = CASE WHEN "eggs" = '{}'::uuid[] THEN jsonb_build_object('type', 'all') ELSE jsonb_build_object('type', 'eggs', 'eggs', to_jsonb("eggs")) END;
ALTER TABLE "user_command_snippets" ALTER COLUMN "matcher" SET NOT NULL;
ALTER TABLE "user_command_snippets" DROP COLUMN "eggs";
DELETE FROM "settings" WHERE "key" = 'oobe_step';
