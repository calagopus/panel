import { z } from 'zod';
import { databaseAgentType, databaseType } from '@/lib/schemas/generic.ts';

const jdbcSubprotocols: Record<z.infer<typeof databaseType> | z.infer<typeof databaseAgentType>, string> = {
  mysql: 'mysql',
  postgres: 'postgresql',
  mariadb: 'mariadb',
  mongodb: 'mongodb',
  redis: 'redis',
};

export function getJdbcConnectionString({
  type,
  username,
  password,
  host,
  database,
}: {
  type: z.infer<typeof databaseType> | z.infer<typeof databaseAgentType>;
  username: string;
  password?: string | null;
  host: string;
  database?: string | null;
}): string {
  return `jdbc:${jdbcSubprotocols[type]}://${username}${
    password ? `:${encodeURIComponent(password)}` : ''
  }@${host}${database ? `/${database}` : ''}`;
}
