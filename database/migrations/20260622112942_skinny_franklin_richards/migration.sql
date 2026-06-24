ALTER TABLE "egg_repository_eggs" ADD COLUMN "readme" text;
ALTER TABLE "egg_repository_eggs" ADD COLUMN "updated" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "egg_repository_eggs" DROP COLUMN "name";
ALTER TABLE "egg_repository_eggs" DROP COLUMN "description";
ALTER TABLE "egg_repository_eggs" DROP COLUMN "author";