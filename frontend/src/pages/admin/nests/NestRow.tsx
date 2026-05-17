import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';

export default function NestRow({ nest }: { nest: z.infer<typeof adminNestSchema> }) {
  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/nests/${nest.uuid}`}>
          <Code>{nest.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{nest.name}</TableData>

      <TableData>{nest.author}</TableData>

      <TableData>{nest.description}</TableData>

      <TableData>
        <FormattedTimestamp timestamp={nest.created} />
      </TableData>
    </TableRow>
  );
}
