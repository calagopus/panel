import { faBan } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { forwardRef, memo } from 'react';
import { TableData, TableRow, TableSelectionCell } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import { ContextMenuChildrenProps, ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import RedactedText from '@/elements/typography/RedactedText.tsx';
import { statusToColor } from '@/lib/domain/server.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { useServerStats } from '@/plugins/server/useServerStats.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface ServerRowProps {
  server: AdminServer;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean, range?: boolean) => void;
  onClick?: (event: React.MouseEvent) => void;
  contextMenuProps?: ContextMenuChildrenProps;
}

function ServerStatus({ server, stats }: { server: AdminServer; stats: ReturnType<typeof useServerStats> }) {
  const { t } = useTranslations();

  if (server.isSuspended) {
    return (
      <>
        <FontAwesomeIcon icon={faBan} className='size-3 mr-2 text-server-status-offline' />
        {t('common.server.state.suspended', {})}
      </>
    );
  }

  return (
    <>
      <span className={classNames('rounded-full size-3 animate-pulse mr-2', statusToColor(stats?.state))} />
      {!stats ? t('common.enum.serverState.unknown', {}) : t(`common.enum.serverState.${stats.state}`, {})}
    </>
  );
}

const ServerRow = memo(
  forwardRef<HTMLTableRowElement, ServerRowProps>(function ServerRow(
    { server, isSelected = false, onSelectionChange, onClick, contextMenuProps },
    ref,
  ) {
    const { t } = useTranslations();
    const stats = useServerStats(server);

    return (
      <TableRow
        bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}
        onClick={onClick}
        onContextMenu={(e) => {
          if (!contextMenuProps) return;

          e.preventDefault();
          contextMenuProps.openMenu(e.clientX, e.clientY);
        }}
        ref={ref}
      >
        {onSelectionChange !== undefined && (
          <TableSelectionCell id={server.uuid} checked={isSelected} onChange={onSelectionChange} />
        )}

        <TableData>
          <TableLink to={`/admin/servers/${server.uuid}`}>
            <Code>{server.uuid}</Code>
          </TableLink>
        </TableData>

        <TableData>
          <div className='flex flex-row items-center'>
            <ServerStatus server={server} stats={stats} />
          </div>
        </TableData>

        <TableData>{server.name}</TableData>

        <TableData>
          <TableLink to={`/admin/nodes/${server.node.uuid}`}>
            <Code>{server.node.name}</Code>
          </TableLink>
        </TableData>

        <TableData>
          <TableLink to={`/admin/users/${server.owner.uuid}`}>
            <Code>{server.owner.username}</Code>
          </TableLink>
        </TableData>

        <TableData>
          <Code>
            {server.allocation ? (
              <RedactedText value={`${server.allocation.ip}:${server.allocation.port}`} />
            ) : (
              t('common.na', {})
            )}
          </Code>
        </TableData>

        <TableData>
          <FormattedTimestamp timestamp={server.created} />
        </TableData>

        {contextMenuProps && (
          <TableData className='relative cursor-pointer min-w-10 text-center'>
            <ContextMenuToggle items={contextMenuProps.items} openMenu={contextMenuProps.openMenu} />
          </TableData>
        )}
      </TableRow>
    );
  }),
);

export default ServerRow;
