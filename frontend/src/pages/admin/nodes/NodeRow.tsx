import { faGlobe, faHeart, faHeartBroken } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { forwardRef, useEffect, useState } from 'react';
import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import Code from '@/elements/Code.tsx';
import { ContextMenuChildrenProps, ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import TableLink from '@/elements/TableLink.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { getNodeUrl, isNodeAIO } from '@/lib/node.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { parseVersion } from '@/lib/version.ts';
import { useNodeToken } from '@/plugins/useNodeToken.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useAdminStore } from '@/stores/admin.tsx';

interface NodeRowProps {
  node: z.infer<typeof adminNodeSchema>;
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
  const { updateInformation } = useAdminStore();

  const [version, setVersion] = useState<string | null>(null);
  const { token } = useNodeToken(node.uuid, { silent: true });

  useEffect(() => {
    if (!token) {
      return;
    }

    axiosInstance
      .get(getNodeUrl(node, '/api/system'), {
        headers: {
          Authorization: `Bearer ${token.token}`,
        },
      })
      .then(({ data }) => {
        setVersion(data.version ?? 'Unavailable');
      })
      .catch((msg) => {
        console.error('Error while connecting to node', msg);
        setVersion('Unavailable');
      });
  }, [node, token]);

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
        {version ? (
          version === 'Unavailable' ? (
            <Tooltip label={t('pages.admin.nodes.tabs.general.page.tooltip.errorWhileFetchingVersion', {})}>
              <FontAwesomeIcon icon={faHeartBroken} className='text-red-500' />
            </Tooltip>
          ) : updateInformation && parseVersion(updateInformation.latestWingsVersion).isNewerThan(version) ? (
            <Tooltip label={t('pages.admin.nodes.tabs.general.page.tooltip.updateAvailable', { version })}>
              <FontAwesomeIcon icon={faHeart} className='text-yellow-500 animate-pulse' />
            </Tooltip>
          ) : (
            <Tooltip label={version}>
              <FontAwesomeIcon icon={faHeart} className='text-green-500 animate-pulse' />
            </Tooltip>
          )
        ) : (
          <Spinner size={16} />
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
        <TableLink to={`/admin/locations/${node.location.uuid}`}>
          <Code>{node.location.name}</Code>
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
