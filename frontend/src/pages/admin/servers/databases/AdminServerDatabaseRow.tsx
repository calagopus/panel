import TableLink from '@/elements/data-display/TableLink.tsx';
import Code from '@/elements/typography/Code.tsx';
import { AdminServer, AdminServerServerDatabase } from '@/lib/schemas/admin/servers.ts';
import DatabaseTableRow from '@/pages/admin/database-hosts/databases/DatabaseTableRow.tsx';

export default function AdminServerDatabaseRow({
  server,
  database,
}: {
  server: AdminServer;
  database: AdminServerServerDatabase;
}) {
  return (
    <DatabaseTableRow
      database={database}
      serverUuid={server.uuid}
      hostUuid={database.databaseHost.uuid}
      linkColumn={
        <TableLink to={`/admin/database-hosts/${database.databaseHost.uuid}`}>
          <Code>{database.databaseHost.name}</Code>
        </TableLink>
      }
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.databases.contextMenu}
      registryProps={{ server, database }}
    />
  );
}
