import { forwardRef } from 'react';
import { z } from 'zod';
import getEggCounts from '@/api/admin/eggs/getEggCounts.ts';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { ContextMenuChildrenProps, ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';
import { useResource } from '@/plugins/resource/useResource.ts';

interface EggRowProps {
  nest: z.infer<typeof adminNestSchema>;
  egg: z.infer<typeof adminEggSchema>;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
  contextMenuProps?: ContextMenuChildrenProps;
}

const EggRow = forwardRef<HTMLTableRowElement, EggRowProps>(function EggRow(
  { nest, egg, isSelected = false, onSelectionChange, contextMenuProps },
  ref,
) {
  const { data: counts, loading: countsLoading } = useResource({
    queryKey: queryKeys.admin.eggs.counts(),
    queryFn: getEggCounts,
    silent: true,
  });

  return (
    <TableRow
      bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          onSelectionChange?.(true, e.shiftKey);
          return true;
        }

        return false;
      }}
      onContextMenu={(e) => {
        if (!contextMenuProps) return;

        e.preventDefault();
        contextMenuProps.openMenu(e.clientX, e.clientY);
      }}
      ref={ref}
    >
      {onSelectionChange !== undefined && (
        <TableSelectionCell id={egg.uuid} checked={isSelected} onChange={onSelectionChange} />
      )}

      <TableData>
        <TableLink to={`/admin/nests/${nest.uuid}/eggs/${egg.uuid}`}>
          <Code>{egg.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>{egg.name}</TableData>

      <TableData>{egg.author}</TableData>

      <TableData>{egg.description}</TableData>

      <TableData>{counts ? (counts[egg.uuid]?.nestEggServers ?? 0) : countsLoading && <Spinner size={16} />}</TableData>

      <TableData>
        <FormattedTimestamp timestamp={egg.created} />
      </TableData>

      {contextMenuProps && (
        <TableData className='relative cursor-pointer min-w-10 text-center'>
          <ContextMenuToggle items={contextMenuProps.items} openMenu={contextMenuProps.openMenu} />
        </TableData>
      )}
    </TableRow>
  );
});

export default EggRow;
