import { NavLink } from 'react-router';
import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { adminDatabaseHostSchema } from '@/lib/schemas/admin/databaseHosts.ts';

export default function DatabaseHostRow({ databaseHost }: { databaseHost: z.infer<typeof adminDatabaseHostSchema> }) {
  return (
    <TableRow>
      <TableData>
        <NavLink
          to={`/admin/database-hosts/${databaseHost.uuid}`}
          className='text-blue-400 hover:text-blue-200 hover:underline'
        >
          <Code>{databaseHost.uuid}</Code>
        </NavLink>
      </TableData>

      <TableData>{databaseHost.name}</TableData>

      <TableData>{databaseTypeLabelMapping[databaseHost.type]}</TableData>

      <TableData>
        <FormattedTimestamp timestamp={databaseHost.created} />
      </TableData>
    </TableRow>
  );
}
