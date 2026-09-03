import { z } from 'zod';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { adminEggRepositorySchema } from '@/lib/schemas/admin/eggRepositories.ts';

export default function EggRepositoryRow({
  eggRepository,
}: {
  eggRepository: z.infer<typeof adminEggRepositorySchema>;
}) {
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
        <FormattedTimestamp timestamp={eggRepository.created} />
      </TableData>
    </TableRow>
  );
}
