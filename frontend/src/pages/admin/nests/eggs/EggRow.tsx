import { forwardRef } from 'react';
import { NavLink } from 'react-router';
import { z } from 'zod';
import Code from '@/elements/Code.tsx';
import { ContextMenuChildrenProps, ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';
import { adminNestSchema } from '@/lib/schemas/admin/nests.ts';

interface EggRowProps {
  nest: z.infer<typeof adminNestSchema>;
  egg: z.infer<typeof adminEggSchema>;
  showSelection?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  contextMenuProps?: ContextMenuChildrenProps;
}

const EggRow = forwardRef<HTMLTableRowElement, EggRowProps>(function EggRow(
  { nest, egg, showSelection, isSelected, onSelectionChange, contextMenuProps },
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
      onContextMenu={(e) => {
        if (!contextMenuProps) return;

        e.preventDefault();
        contextMenuProps.openMenu(e.pageX, e.pageY);
      }}
      ref={ref}
    >
      {showSelection && (
        <TableData className='pl-4 relative cursor-pointer w-10 text-center'>
          <Checkbox
            id={egg.uuid}
            checked={isSelected}
            onChange={(e) => {
              onSelectionChange?.(e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            classNames={{ input: 'cursor-pointer!' }}
          />
        </TableData>
      )}

      <TableData>
        <NavLink
          to={`/admin/nests/${nest.uuid}/eggs/${egg.uuid}`}
          className='text-blue-400 hover:text-blue-200 hover:underline'
        >
          <Code>{egg.uuid}</Code>
        </NavLink>
      </TableData>

      <TableData>{egg.name}</TableData>

      <TableData>{egg.author}</TableData>

      <TableData>{egg.description}</TableData>

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
