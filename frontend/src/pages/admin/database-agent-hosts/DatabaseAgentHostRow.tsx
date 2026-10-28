import { forwardRef, ReactNode } from 'react';
import { z } from 'zod';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import { ContextMenuChildrenProps, ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { adminDatabaseAgentHostSchema } from '@/lib/schemas/admin/databaseAgentHosts.ts';
import { adminUpgradeStatusSchema } from '@/lib/schemas/admin/system.ts';
import { useDatabaseAgentHostDeployment } from '@/plugins/database-agent-hosts/useDatabaseAgentHostDeployment.ts';
import DatabaseAgentHostDeploymentBadge from './DatabaseAgentHostDeploymentBadge.tsx';
import DatabaseAgentHostHealthIcon from './DatabaseAgentHostHealthIcon.tsx';

interface DatabaseAgentHostRowProps {
  databaseAgentHost: z.infer<typeof adminDatabaseAgentHostSchema>;
  upgradeStatus?: z.infer<typeof adminUpgradeStatusSchema>;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
  contextMenuProps?: ContextMenuChildrenProps;
  nameSection?: ReactNode;
}

const DatabaseAgentHostRow = forwardRef<HTMLTableRowElement, DatabaseAgentHostRowProps>(function DatabaseAgentHostRow(
  { databaseAgentHost, upgradeStatus, isSelected = false, onSelectionChange, contextMenuProps, nameSection },
  ref,
) {
  const { instances } = useDatabaseAgentHostDeployment(databaseAgentHost);

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
        <TableSelectionCell id={databaseAgentHost.uuid} checked={isSelected} onChange={onSelectionChange} />
      )}

      <TableData>
        <DatabaseAgentHostHealthIcon databaseAgentHost={databaseAgentHost} upgradeStatus={upgradeStatus} />
      </TableData>

      <TableData>
        <TableLink to={`/admin/database-agent-hosts/${databaseAgentHost.uuid}`}>
          <Code>{databaseAgentHost.uuid}</Code>
        </TableLink>
      </TableData>

      <TableData>
        <span className='flex gap-2 items-center'>
          {databaseAgentHost.name}&nbsp;
          <DatabaseAgentHostDeploymentBadge databaseAgentHost={databaseAgentHost} />
          {nameSection}
        </span>
      </TableData>

      <TableData>{instances}</TableData>

      <TableData>
        <FormattedTimestamp timestamp={databaseAgentHost.created} />
      </TableData>

      {contextMenuProps && (
        <TableData className='relative cursor-pointer min-w-10 text-center'>
          <ContextMenuToggle items={contextMenuProps.items} openMenu={contextMenuProps.openMenu} />
        </TableData>
      )}
    </TableRow>
  );
});

export default DatabaseAgentHostRow;
