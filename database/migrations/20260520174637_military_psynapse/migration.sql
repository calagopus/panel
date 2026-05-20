ALTER TABLE "email_templates" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "email_templates" ADD COLUMN "subject" varchar(255) NOT NULL;