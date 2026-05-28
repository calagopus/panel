import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { adminLocationSchema } from '@/lib/schemas/admin/locations.ts';

export default ({ location }: { location: z.infer<typeof adminLocationSchema> }) => {
  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/locations/${location.uuid}`}>
          <Code>{location.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{location.name}</TableData>

      <TableData>
        <Code>
          {location.backupConfiguration ? (
            <TableLink to={`/admin/backup-configurations/${location.backupConfiguration.uuid}`}>
              {location.backupConfiguration.name}
            </TableLink>
          ) : (
            '-'
          )}
        </Code>
      </TableData>

      <TableData>
        <FormattedTimestamp timestamp={location.created} />
      </TableData>
    </TableRow>
  );
};
