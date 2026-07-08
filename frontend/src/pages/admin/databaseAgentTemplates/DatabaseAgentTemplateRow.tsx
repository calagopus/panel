import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { databaseAgentTypeLabelMapping } from '@/lib/enums.ts';
import { adminDatabaseAgentTemplateSchema } from '@/lib/schemas/admin/databaseAgentTemplates.ts';

export default function DatabaseAgentTemplateRow({
  databaseAgentTemplate,
}: {
  databaseAgentTemplate: z.infer<typeof adminDatabaseAgentTemplateSchema>;
}) {
  return (
    <TableRow>
      <TableData>
        <TableLink to={`/admin/database-agent-templates/${databaseAgentTemplate.uuid}`}>
          <Code>{databaseAgentTemplate.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{databaseAgentTemplate.name}</TableData>

      <TableData>{databaseAgentTypeLabelMapping[databaseAgentTemplate.type]}</TableData>

      <TableData>
        <FormattedTimestamp timestamp={databaseAgentTemplate.created} />
      </TableData>
    </TableRow>
  );
}
