import { z } from 'zod';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Code from '@/elements/typography/Code.tsx';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { adminServerDatabaseSchema } from '@/lib/schemas/admin/servers.ts';
import DatabaseTableRow from './DatabaseTableRow.tsx';

export default function DatabaseRow({
  databaseHost,
  database,
}: {
  databaseHost: z.infer<typeof adminDatabaseHostSchema>;
  database: z.infer<typeof adminServerDatabaseSchema>;
}) {
  return (
    <DatabaseTableRow
      database={database}
      serverUuid={database.server.uuid}
      hostUuid={databaseHost.uuid}
      linkColumn={
        <TableLink to={`/admin/servers/${database.server.uuid}`}>
          <Code>{database.server.name}</Code>
        </TableLink>
      }
      registry={window.extensionContext.extensionRegistry.pages.admin.databaseHosts.view.databases.contextMenu}
      registryProps={{ databaseHost, database }}
    />
  );
}
