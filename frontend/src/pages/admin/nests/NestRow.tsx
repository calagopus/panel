import { z } from 'zod';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
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
