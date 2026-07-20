ALTER TABLE "oauth_provider_mappings" ADD COLUMN "matcher" jsonb;
UPDATE "oauth_provider_mappings" SET "matcher" = CASE
  WHEN cardinality("scopes") = 0 THEN '{"type":"none"}'::jsonb
  ELSE jsonb_build_object('type', 'scopes', 'scopes', to_jsonb("scopes"))
END;
ALTER TABLE "oauth_provider_mappings" ALTER COLUMN "matcher" SET NOT NULL;
ALTER TABLE "oauth_provider_mappings" DROP COLUMN "scopes";
