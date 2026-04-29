ALTER TABLE "nest_eggs" RENAME COLUMN "startup" TO "startup_commands";

ALTER TABLE "nest_eggs" 
  ALTER COLUMN "startup_commands" 
  SET DATA TYPE json 
  USING json_build_object('Default', "startup_commands");