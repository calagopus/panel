import { forwardRef, memo } from 'react';
import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { adminNodeAllocationSchema } from '@/lib/schemas/admin/nodes.ts';
import { useAdminStore } from '@/stores/admin.tsx';

interface NodeAllocationRowProps {
  allocation: z.infer<typeof adminNodeAllocationSchema>;
}

const NodeAllocationRow = memo(
  forwardRef<HTMLTableRowElement, NodeAllocationRowProps>(function FileRow({ allocation }, ref) {
    const { selectedNodeAllocations, addSelectedNodeAllocation, removeSelectedNodeAllocation } = useAdminStore();

    const isNodeAllocationSelected = selectedNodeAllocations.has(allocation);

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
              '-'
            )}
          </Code>
        </TableData>

        <TableData>
          <Code>{allocation.ip}</Code>
        </TableData>

        <TableData>
          <Code>{allocation.ipAlias ?? 'N/A'}</Code>
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
