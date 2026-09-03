import { z } from 'zod';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';

export default function DatabaseHostRow({ databaseHost }: { databaseHost: z.infer<typeof adminDatabaseHostSchema> }) {
  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/database-hosts/${databaseHost.uuid}`}>
          <Code>{databaseHost.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{databaseHost.name}</TableData>

      <TableData>{databaseTypeLabelMapping[databaseHost.type]}</TableData>

      <TableData>
        <FormattedTimestamp timestamp={databaseHost.created} />
      </TableData>
    </TableRow>
  );
}
