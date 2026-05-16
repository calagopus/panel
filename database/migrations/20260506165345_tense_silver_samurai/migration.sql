DROP INDEX "egg_variables_egg_uuid_name_idx";
ALTER TABLE "nest_egg_variables" ADD COLUMN "name_translations" jsonb DEFAULT '{}' NOT NULL;