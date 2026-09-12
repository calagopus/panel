CREATE TABLE "email_variables" (
	"template_identifier" varchar(255),
	"name" varchar(64),
	"value" text,
	"value_translations" jsonb DEFAULT '{}' NOT NULL,
	CONSTRAINT "email_variables_template_identifier_name_pk" PRIMARY KEY("template_identifier","name")
);
