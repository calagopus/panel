import { z } from 'zod';
import getDatabaseHostCounts from '@/api/admin/database-hosts/getDatabaseHostCounts.ts';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import DatabaseHostHealthIcon from './DatabaseHostHealthIcon.tsx';

export default function DatabaseHostRow({ databaseHost }: { databaseHost: z.infer<typeof adminDatabaseHostSchema> }) {
  const { data: counts, loading: countsLoading } = useResource({
    queryKey: queryKeys.admin.databaseHosts.counts(),
    queryFn: getDatabaseHostCounts,
    silent: true,
  });

  return (
    <TableRow>
      <TableData>
        <DatabaseHostHealthIcon databaseHost={databaseHost} />
      </TableData>

      <TableData>
        <TableLink to={`/admin/database-hosts/${databaseHost.uuid}`}>
          <Code>{databaseHost.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{databaseHost.name}</TableData>

      <TableData>{databaseTypeLabelMapping[databaseHost.type]}</TableData>

      <TableData>
        {counts
          ? (counts[databaseHost.uuid]?.databaseHostServerDatabases ?? 0)
          : countsLoading && <Spinner size={16} />}
      </TableData>

      <TableData>
        <FormattedTimestamp timestamp={databaseHost.created} />
      </TableData>
    </TableRow>
  );
}
