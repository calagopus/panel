import { z } from 'zod';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { adminEggConfigurationSchema } from '@/lib/schemas/admin/eggConfigurations.ts';

export default function EggConfigurationRow({
  eggConfiguration,
}: {
  eggConfiguration: z.infer<typeof adminEggConfigurationSchema>;
}) {
  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/egg-configurations/${eggConfiguration.uuid}`}>
          <Code>{eggConfiguration.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{eggConfiguration.order}</TableData>

      <TableData>{eggConfiguration.name}</TableData>

      <TableData>{eggConfiguration.eggs.length}</TableData>

      <TableData>
        <FormattedTimestamp timestamp={eggConfiguration.created} />
      </TableData>
    </TableRow>
  );
}
