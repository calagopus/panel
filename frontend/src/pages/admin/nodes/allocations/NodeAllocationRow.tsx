import { forwardRef, memo } from 'react';
import { z } from 'zod';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { ObjectSet } from '@/lib/objectSet.ts';
import { adminNodeAllocationSchema } from '@/lib/schemas/admin/nodes.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface NodeAllocationRowProps {
  allocation: z.infer<typeof adminNodeAllocationSchema>;
  selectedNodeAllocations: ObjectSet<z.infer<typeof adminNodeAllocationSchema>, 'uuid'>;
  selectedAllMatching: boolean;
  addSelectedNodeAllocation: (allocation: z.infer<typeof adminNodeAllocationSchema>) => void;
  removeSelectedNodeAllocation: (allocation: z.infer<typeof adminNodeAllocationSchema>) => void;
}

const NodeAllocationRow = memo(
  forwardRef<HTMLTableRowElement, NodeAllocationRowProps>(function NodeAllocationRow(
    {
      allocation,
      selectedNodeAllocations,
      selectedAllMatching,
      addSelectedNodeAllocation,
      removeSelectedNodeAllocation,
    },
    ref,
  ) {
    const { t } = useTranslations();

    const isNodeAllocationSelected = selectedAllMatching || selectedNodeAllocations.has(allocation);

    return (
      <TableRow
        bg={isNodeAllocationSelected ? 'var(--mantine-color-blue-light)' : undefined}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey) {
            addSelectedNodeAllocation(allocation);
            return true;
          }

          return false;
        }}
        ref={ref}
      >
        <td className='pl-4 relative cursor-pointer w-10 text-center'>
          <Checkbox
            id={allocation.uuid}
            checked={isNodeAllocationSelected}
            disabled={selectedAllMatching}
            onChange={() => {
              if (isNodeAllocationSelected) {
                removeSelectedNodeAllocation(allocation);
              } else {
                addSelectedNodeAllocation(allocation);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </td>

        <TableData>
          <Code>{allocation.uuid}</Code>
        </TableData>

        <TableData>
          <Code>
            {allocation.server ? (
              <TableLink to={`/admin/servers/${allocation.server.uuid}`}>{allocation.server.name}</TableLink>
            ) : (
              t('common.na', {})
            )}
          </Code>
        </TableData>

        <TableData>
          <Code>{allocation.ip}</Code>
        </TableData>

        <TableData>
          <Code>{allocation.ipAlias ?? t('common.na', {})}</Code>
        </TableData>

        <TableData>
          <Code>{allocation.port}</Code>
        </TableData>

        <TableData>
          <FormattedTimestamp timestamp={allocation.created} />
        </TableData>
      </TableRow>
    );
  }),
);

export default NodeAllocationRow;
