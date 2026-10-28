import { z } from 'zod';
import getEggRepositoryCounts from '@/api/admin/egg-repositories/getEggRepositoryCounts.ts';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { useResource } from '@/plugins/resource/useResource.ts';

export default function EggRepositoryRow({
  eggRepository,
}: {
  eggRepository: z.infer<typeof adminEggRepositorySchema>;
}) {
  const { data: counts, loading: countsLoading } = useResource({
    queryKey: queryKeys.admin.eggRepositories.counts(),
    queryFn: getEggRepositoryCounts,
    silent: true,
  });

  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/egg-repositories/${eggRepository.uuid}`}>
          <Code>{eggRepository.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{eggRepository.name}</TableData>

      <TableData>{eggRepository.description}</TableData>

      <TableData>
        <Code>{eggRepository.gitRepository}</Code>
      </TableData>

      <TableData>
        {counts ? (counts[eggRepository.uuid]?.eggRepositoryEggs ?? 0) : countsLoading && <Spinner size={16} />}
      </TableData>

      <TableData>
        <FormattedTimestamp timestamp={eggRepository.created} />
      </TableData>
    </TableRow>
  );
}
