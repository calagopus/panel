import { faGlobe, faHeart, faHeartBroken } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { forwardRef } from 'react';
import { TableData, TableRow } from '@/elements/data-display/Table.tsx';
import TableLink from '@/elements/data-display/TableLink.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import { ContextMenuChildrenProps, ContextMenuToggle } from '@/elements/overlays/ContextMenu.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Code from '@/elements/typography/Code.tsx';
import { isNodeAIO } from '@/lib/domain/node.ts';
import { AdminNode } from '@/lib/schemas/admin/nodes.ts';
import { useNodeVersion } from '@/plugins/nodes/useNodeVersion.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface NodeRowProps {
  node: AdminNode;
  desync?: number;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  contextMenuProps?: ContextMenuChildrenProps;
}

const NodeRow = forwardRef<HTMLTableRowElement, NodeRowProps>(function NodeRow(
  { node, desync, isSelected, onSelectionChange, contextMenuProps },
  ref,
) {
  const { t } = useTranslations();
  const { version, unavailable, loading, updateAvailable } = useNodeVersion(node);

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
        contextMenuProps.openMenu(e.clientX, e.clientY);
      }}
      ref={ref}
    >
      {onSelectionChange !== undefined && (
        <TableData className='pl-4 relative cursor-pointer w-10 text-center'>
          <Checkbox
            id={node.uuid}
            checked={isSelected}
            onChange={(e) => onSelectionChange(e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            classNames={{ input: 'cursor-pointer!' }}
          />
        </TableData>
      )}

      <TableData>
        {loading ? (
          <Spinner size={16} />
        ) : unavailable || !version ? (
          <Tooltip label={t('pages.admin.nodes.tabs.general.page.tooltip.errorWhileFetchingVersion', {})}>
            <FontAwesomeIcon icon={faHeartBroken} className='text-red-500' />
          </Tooltip>
        ) : updateAvailable ? (
          <Tooltip label={t('pages.admin.nodes.tabs.general.page.tooltip.updateAvailable', { version })}>
            <FontAwesomeIcon icon={faHeart} className='text-yellow-500 animate-pulse' />
          </Tooltip>
        ) : (
          <Tooltip label={version}>
            <FontAwesomeIcon icon={faHeart} className='text-green-500 animate-pulse' />
          </Tooltip>
        )}
      </TableData>

      <TableData>
        <TableLink to={`/admin/nodes/${node.uuid}`}>
          <Code>{node.uuid}</Code>
        </TableLink>
      </TableData>

      {desync !== undefined && <TableData>{desync}ms</TableData>}

      <TableData>
        <span className='flex gap-2 items-center'>
          {node.name}&nbsp;
          {node.deploymentEnabled ? (
            <Tooltip label={t('pages.admin.nodes.tabs.general.page.tooltip.deploymentEnabled', {})}>
              <FontAwesomeIcon icon={faGlobe} className='text-green-500' />
            </Tooltip>
          ) : (
            <Tooltip label={t('pages.admin.nodes.tabs.general.page.tooltip.deploymentDisabled', {})}>
              <FontAwesomeIcon icon={faGlobe} className='text-red-500' />
            </Tooltip>
          )}
          {isNodeAIO(node) && (
            <Tooltip label={t('pages.admin.nodes.tabs.general.page.tooltip.allInOneNode', {})}>
              <FontAwesomeIcon icon={faHeart} className='text-purple-500' />
            </Tooltip>
          )}
        </span>
      </TableData>

      <TableData>
        <TableLink to={`/admin/locations/${node.location.uuid}`} className='block w-fit'>
          <Code className='flex flex-row items-center w-fit'>
            {node.location.flag && (
              <img
                src={`/flags/${node.location.flag}.svg`}
                alt={node.location.name}
                className='w-5 h-5 mr-1 rounded-md shrink-0 my-auto'
              />
            )}{' '}
            {node.location.name}
          </Code>
        </TableLink>
      </TableData>

      <TableData>
        <FormattedTimestamp timestamp={node.created} />
      </TableData>

      {contextMenuProps && (
        <TableData className='relative cursor-pointer min-w-10 text-center'>
          <ContextMenuToggle items={contextMenuProps.items} openMenu={contextMenuProps.openMenu} />
        </TableData>
      )}
    </TableRow>
  );
});

export default NodeRow;
