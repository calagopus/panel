import { z } from 'zod';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { roleSchema } from '@/lib/schemas/user.ts';

export default function RoleRow({ role }: { role: z.infer<typeof roleSchema> }) {
  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/roles/${role.uuid}`}>
          <Code>{role.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{role.name}</TableData>

      <TableData>{role.serverPermissions.length}</TableData>

      <TableData>{role.adminPermissions.length}</TableData>

      <TableData>
        <FormattedTimestamp timestamp={role.created} />
      </TableData>
    </TableRow>
  );
}
