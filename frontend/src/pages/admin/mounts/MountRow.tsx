import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { adminMountSchema } from '@/lib/schemas/admin/mounts.ts';

export default function MountRow({ mount }: { mount: z.infer<typeof adminMountSchema> }) {
  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/mounts/${mount.uuid}`}>
          <Code>{mount.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{mount.name}</TableData>
      <TableData>
        <Code>{mount.source}</Code>
      </TableData>
      <TableData>
        <Code>{mount.target}</Code>
      </TableData>
      <TableData>
        <FormattedTimestamp timestamp={mount.created} />
      </TableData>
    </TableRow>
  );
}
