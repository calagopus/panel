import classNames from 'classnames';
import { forwardRef, memo } from 'react';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { statusToColor } from '@/lib/domain/server.ts';
import { AdminServer } from '@/lib/schemas/admin/servers.ts';
import { useServerStats } from '@/plugins/server/useServerStats.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface ServerRowProps {
  server: AdminServer;
  showSelection?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  onClick?: (event: React.MouseEvent) => void;
}

const ServerRow = memo(
  forwardRef<HTMLTableRowElement, ServerRowProps>(function ServerRow(
    { server, showSelection = false, isSelected = false, onSelectionChange, onClick },
    ref,
  ) {
    const { t } = useTranslations();
    const stats = useServerStats(server);

    return (
      <TableRow bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined} onClick={onClick} ref={ref}>
        {showSelection && (
          <TableData className='pl-4 relative cursor-pointer w-10 text-center'>
            <Checkbox
              id={server.uuid}
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
          <TableLink to={`/admin/servers/${server.uuid}`}>
            <Code>{server.uuid}</Code>
          </TableLink>
        </TableData>

        <TableData>
          <div className='flex flex-row items-center'>
            <span className={classNames('rounded-full size-3 animate-pulse mr-2', statusToColor(stats?.state))} />
            {!stats ? t('common.enum.serverState.unknown', {}) : t(`common.enum.serverState.${stats.state}`, {})}
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
          <Code>{server.allocation ? `${server.allocation.ip}:${server.allocation.port}` : t('common.na', {})}</Code>
        </TableData>

        <TableData>
          <FormattedTimestamp timestamp={server.created} />
        </TableData>
      </TableRow>
    );
  }),
);

export default ServerRow;
