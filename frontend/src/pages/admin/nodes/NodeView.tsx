import {
  faArchive,
  faArrowUpLong,
  faCog,
  faComputer,
  faFileLines,
  faFolderTree,
  faInfoCircle,
  faNetworkWired,
  faPenRuler,
} from '@fortawesome/free-solid-svg-icons';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import getNode from '@/api/admin/nodes/getNode.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import { isNodeAIO } from '@/lib/node.ts';
import AdminNodeAllocations from './allocations/AdminNodeAllocations.tsx';
import AdminNodeBackups from './backups/AdminNodeBackups.tsx';
import AdminNodeConfiguration from './configuration/AdminNodeConfiguration.tsx';
import AdminNodeLogs from './logs/AdminNodeLogs.tsx';
import AdminNodeMounts from './mounts/AdminNodeMounts.tsx';
import NodeCreateOrUpdate from './NodeCreateOrUpdate.tsx';
import AdminNodeServers from './servers/AdminNodeServers.tsx';
import AdminNodeStatistics from './statistics/AdminNodeStatistics.tsx';
import AdminNodeTransfers from './transfers/AdminNodeTransfers.tsx';

export default function NodeView() {
  const params = useParams<'id'>();

  const { data: node, isLoading } = useQuery({
    queryKey: ['admin', 'nodes', { uuid: params.id }],
    queryFn: () => getNode(params.id!),
  });

  return isLoading || !node ? (
    <Spinner.Centered />
  ) : (
    <AdminContentContainer title={node.name}>
      <SubNavigation
        baseUrl={`/admin/nodes/${params.id}`}
        items={[
          {
            name: 'General',
            icon: faCog,
            path: '/',
            element: <NodeCreateOrUpdate contextNode={node} />,
          },
          {
            name: 'Configuration',
            icon: faPenRuler,
            path: `/configuration`,
            hidden: isNodeAIO(node),
            element: <AdminNodeConfiguration node={node} />,
          },
          {
            name: 'Statistics',
            icon: faInfoCircle,
            path: `/statistics`,
            element: <AdminNodeStatistics node={node} />,
          },
          {
            name: 'Logs',
            icon: faFileLines,
            path: `/logs`,
            element: <AdminNodeLogs node={node} />,
          },
          {
            name: 'Allocations',
            icon: faNetworkWired,
            path: `/allocations`,
            element: <AdminNodeAllocations node={node} />,
            permission: 'nodes.allocations',
          },
          {
            name: 'Mounts',
            icon: faFolderTree,
            path: `/mounts`,
            element: <AdminNodeMounts node={node} />,
            permission: 'nodes.mounts',
          },
          {
            name: 'Backups',
            icon: faArchive,
            path: `/backups`,
            element: <AdminNodeBackups node={node} />,
            permission: 'nodes.backups',
          },
          {
            name: 'Servers',
            icon: faComputer,
            path: `/servers`,
            element: <AdminNodeServers node={node} />,
            permission: 'servers.read',
          },
          {
            name: 'Outgoing Transfers',
            icon: faArrowUpLong,
            path: `/transfers`,
            element: <AdminNodeTransfers node={node} />,
            permission: 'nodes.transfers',
          },
        ]}
      />
    </AdminContentContainer>
  );
}
