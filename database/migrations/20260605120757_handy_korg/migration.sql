ALTER TABLE "users" ADD COLUMN "frozen" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN "suspended" boolean DEFAULT false NOT NULL;