import { z } from 'zod';
import getNestCounts from '@/api/admin/nests/getNestCounts.ts';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useResource } from '@/plugins/resource/useResource.ts';

export default function NestRow({ nest }: { nest: z.infer<typeof adminNestSchema> }) {
  const { data: counts, loading: countsLoading } = useResource({
    queryKey: queryKeys.admin.nests.counts(),
    queryFn: getNestCounts,
    silent: true,
  });
  const nestCounts = counts?.[nest.uuid];

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

      <TableData>{counts ? (nestCounts?.nestEggs ?? 0) : countsLoading && <Spinner size={16} />}</TableData>

      <TableData>{counts ? (nestCounts?.nestServers ?? 0) : countsLoading && <Spinner size={16} />}</TableData>

      <TableData>
        <FormattedTimestamp timestamp={nest.created} />
      </TableData>
    </TableRow>
  );
}
