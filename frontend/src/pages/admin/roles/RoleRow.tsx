import { z } from 'zod';
import getRoleCounts from '@/api/admin/roles/getRoleCounts.ts';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { roleSchema } from '@/lib/schemas/user.ts';
import { useResource } from '@/plugins/resource/useResource.ts';

export default function RoleRow({ role }: { role: z.infer<typeof roleSchema> }) {
  const { data: counts, loading: countsLoading } = useResource({
    queryKey: queryKeys.admin.roles.counts(),
    queryFn: getRoleCounts,
    silent: true,
  });

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

      <TableData>{counts ? (counts[role.uuid]?.roleUsers ?? 0) : countsLoading && <Spinner size={16} />}</TableData>

      <TableData>
        <FormattedTimestamp timestamp={role.created} />
      </TableData>
    </TableRow>
  );
}
