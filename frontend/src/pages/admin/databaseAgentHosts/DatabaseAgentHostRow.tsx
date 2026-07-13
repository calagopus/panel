import { forwardRef } from 'react';
import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';

interface DatabaseAgentHostRowProps {
  databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
}

const DatabaseAgentHostRow = forwardRef<HTMLTableRowElement, DatabaseAgentHostRowProps>(function DatabaseAgentHostRow(
  { databaseAgentHost, isSelected, onSelectionChange },
  ref,
) {
  return (
    <TableRow
      bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          onSelectionChange?.(true);
          return true;
        }
        return false;
      }}
      ref={ref}
    >
      {onSelectionChange !== undefined && (
        <TableData className='pl-4 relative cursor-pointer w-10 text-center'>
          <Checkbox
            id={databaseAgentHost.uuid}
            checked={isSelected}
            onChange={(e) => onSelectionChange(e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            classNames={{ input: 'cursor-pointer!' }}
          />
        </TableData>
      )}

      <TableData>
        <TableLink to={`/admin/database-agent-hosts/${databaseAgentHost.uuid}`}>
          <Code>{databaseAgentHost.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{databaseAgentHost.name}</TableData>

      <TableData>
        <FormattedTimestamp timestamp={databaseAgentHost.created} />
      </TableData>
    </TableRow>
  );
});

export default DatabaseAgentHostRow;
