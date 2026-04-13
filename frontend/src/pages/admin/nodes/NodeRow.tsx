import { faGlobe, faHeart, faHeartBroken } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { z } from 'zod';
import { axiosInstance } from '@/api/axios.ts';
import Code from '@/elements/Code.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { TableData, TableRow } from '@/elements/Table.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import { getNodeUrl } from '@/lib/node.ts';
import { adminNodeSchema } from '@/lib/schemas/admin/nodes.ts';
import { parseVersion } from '@/lib/version.ts';
import { useAdminStore } from '@/stores/admin.tsx';

export default function NodeRow({ node }: { node: z.infer<typeof adminNodeSchema> }) {
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
    <TableRow>
      <TableData>
        {version ? (
          version === 'Unavailable' ? (
            <Tooltip label='Error while fetching version'>
              <FontAwesomeIcon icon={faHeartBroken} className='text-red-500' />
            </Tooltip>
          ) : updateInformation && parseVersion(updateInformation.latestWings).isNewerThan(version) ? (
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
        <Code>{node.url}</Code>
      </TableData>

      <TableData>
        <FormattedTimestamp timestamp={node.created} />
      </TableData>
    </TableRow>
  );
}
