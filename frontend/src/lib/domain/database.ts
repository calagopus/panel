import { z } from 'zod';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { databaseAgentType, databaseType } from '@/lib/schemas/generic.ts';

const jdbcSubprotocols: Record<z.infer<typeof databaseType> | z.infer<typeof databaseAgentType>, string> = {
  mysql: 'mysql',
  postgres: 'postgresql',
  mariadb: 'mariadb',
  mongodb: 'mongodb',
  redis: 'redis',
};

export function groupDatabaseHostsByType<T extends { uuid: string; name: string; type: z.infer<typeof databaseType> }>(
  hosts: T[],
  toOption: (host: T) => { value: string; label: string; disabled?: boolean } = (host) => ({
    value: host.uuid,
    label: host.name,
  }),
): GroupedDatabaseHosts {
  return hosts.reduce((acc, host) => {
    if (!acc[host.type]) {
      acc[host.type] = { group: databaseTypeLabelMapping[host.type], items: [] };
    }
    acc[host.type].items.push(toOption(host));
    return acc;
  }, {} as GroupedDatabaseHosts);
}

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
