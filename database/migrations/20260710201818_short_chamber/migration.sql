ALTER TABLE "database_agent_templates" ADD COLUMN "socket_path" varchar(1020);--> statement-breakpoint
UPDATE "database_agent_templates" SET "socket_path" = CASE "type"
  WHEN 'POSTGRES' THEN '/var/run/postgresql/.s.PGSQL.5432'
  WHEN 'MARIADB' THEN '/run/mysqld/mysqld.sock'
  WHEN 'MONGODB' THEN '/tmp/mongodb-27017.sock'
  WHEN 'REDIS' THEN '/run/redis/redis.sock'
END;--> statement-breakpoint
ALTER TABLE "database_agent_templates" ALTER COLUMN "socket_path" SET NOT NULL;
