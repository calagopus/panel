CREATE TABLE "version_history" (
	"extension" varchar(255),
	"version" varchar(255),
	"installed" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "version_history_extension_version_pk" PRIMARY KEY("extension","version")
);

ALTER TABLE "settings" ALTER COLUMN "key" SET DATA TYPE varchar(512) USING "key"::varchar(512);