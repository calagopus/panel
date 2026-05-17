import { useEffect, useState } from 'react';
import { z } from 'zod';
import getDatabaseSize from '@/api/server/databases/getDatabaseSize.ts';
import Code from '@/elements/Code.tsx';
import CopyOnClick from '@/elements/CopyOnClick.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { databaseTypeLabelMapping } from '@/lib/enums.ts';
import { adminServerDatabaseSchema } from '@/lib/schemas/admin/servers.ts';
import { bytesToString } from '@/lib/size.ts';

export default function DatabaseRow({ database }: { database: z.infer<typeof adminServerDatabaseSchema> }) {
  const [size, setSize] = useState(0);
  const [sizeLoading, setSizeLoading] = useState(true);
  const host = `${database.host}:${database.port}`;

  useEffect(() => {
    getDatabaseSize(database.server.uuid, database.uuid)
      .then(setSize)
      .finally(() => setSizeLoading(false));
  }, []);

  return (
    <>
      <TableRow>
        <TableData>{database.name}</TableData>

        <TableData>
          <TableLink to={`/admin/servers/${database.server.uuid}`}>
            <Code>{database.server.name}</Code>
          </TableLink>
        </TableData>

        <TableData>{databaseTypeLabelMapping[database.type]}</TableData>

        <TableData>
          <CopyOnClick content={host}>
            <Code>{host}</Code>
          </CopyOnClick>
        </TableData>

        <TableData>{database.username}</TableData>

        <TableData>{sizeLoading ? <Spinner size={16} /> : bytesToString(size)}</TableData>

        <TableData>
          <FormattedTimestamp timestamp={database.created} />
        </TableData>
      </TableRow>
    </>
  );
}
