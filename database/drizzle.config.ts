import { filesystem } from '@rjweb/utils';
import { defineConfig } from 'drizzle-kit';

let env: Record<string, string>;
try {
  env = filesystem.env('../.env', { async: false });
} catch {
  env = process.env as Record<string, string>;
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  breakpoints: false,
  dbCredentials: {
    url: env.DATABASE_URL_PRIMARY ?? env.DATABASE_URL,
  },
});
