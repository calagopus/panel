import { faGlobe, faHeart, faHeartBroken } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import Code from '@/elements/Code.tsx';
import { ContextMenuChildrenProps, ContextMenuToggle } from '@/elements/ContextMenu.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { getNodeUrl, isNodeAIO } from '@/lib/node.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { parseVersion } from '@/lib/version.ts';
import { useAdminStore } from '@/stores/admin.tsx';

export default function NodeRow({
  node,
  desync,
  contextMenuProps,
}: {
  node: z.infer<typeof adminNodeSchema>;
  desync?: number;
  contextMenuProps?: ContextMenuChildrenProps;
}) {
  const { updateInformation } = useAdminStore();

  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    axiosInstance
      .get(getNodeUrl(node, '/api/system'), {
        headers: {
          Authorization: `Bearer ${node.token}`,
        },
      })
      .then(({ data }) => {
        setVersion(data.version ?? 'Unavailable');
      })
      .catch((msg) => {
        console.error('Error while connecting to node', msg);
        setVersion('Unavailable');
      });
  }, []);

  return (
    <TableRow
      onContextMenu={(e) => {
        if (!contextMenuProps) return;

        e.preventDefault();
        contextMenuProps.openMenu(e.pageX, e.pageY);
      }}
    >
      <TableData>
        {version ? (
          version === 'Unavailable' ? (
            <Tooltip label='Error while fetching version'>
              <FontAwesomeIcon icon={faHeartBroken} className='text-red-500' />
            </Tooltip>
          ) : updateInformation && parseVersion(updateInformation.latestWingsVersion).isNewerThan(version) ? (
            <Tooltip label={`${version} (Update Available)`}>
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
        <NavLink to={`/admin/nodes/${node.uuid}`} className='text-blue-400 hover:text-blue-200 hover:underline'>
          <Code>{node.uuid}</Code>
        </NavLink>
      </TableData>

      {desync !== undefined && <TableData>{desync}ms</TableData>}

      <TableData>
        <span className='flex gap-2 items-center'>
          {node.name}&nbsp;
          {node.deploymentEnabled ? (
            <Tooltip label='Deployment Enabled'>
              <FontAwesomeIcon icon={faGlobe} className='text-green-500' />
            </Tooltip>
          ) : (
            <Tooltip label='Deployment Disabled'>
              <FontAwesomeIcon icon={faGlobe} className='text-red-500' />
            </Tooltip>
          )}
          {isNodeAIO(node) && (
            <Tooltip label='All-in-One Node'>
              <FontAwesomeIcon icon={faHeart} className='text-purple-500' />
            </Tooltip>
          )}
        </span>
      </TableData>

      <TableData>
        <NavLink
          to={`/admin/locations/${node.location.uuid}`}
          className='text-blue-400 hover:text-blue-200 hover:underline'
        >
          <Code>{node.location.name}</Code>
        </NavLink>
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
}
