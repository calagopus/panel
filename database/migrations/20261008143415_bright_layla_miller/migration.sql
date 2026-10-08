ALTER TABLE "servers" ADD COLUMN "bandwidth_upload" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "servers" ADD COLUMN "bandwidth_download" bigint DEFAULT 0 NOT NULL;