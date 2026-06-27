import {
  faArchive,
  faArrowUpLong,
  faCog,
  faComputer,
  faFileLines,
  faFolderTree,
  faHouse,
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
import { queryKeys } from '@/lib/queryKeys.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminNodeAllocations from './allocations/AdminNodeAllocations.tsx';
import AdminNodeBackups from './backups/AdminNodeBackups.tsx';
import AdminNodeConfiguration from './configuration/AdminNodeConfiguration.tsx';
import AdminNodeLogs from './logs/AdminNodeLogs.tsx';
import AdminNodeMounts from './mounts/AdminNodeMounts.tsx';
import NodeCreateOrUpdate from './NodeCreateOrUpdate.tsx';
import NodeOverview from './NodeOverview.tsx';
import AdminNodeServers from './servers/AdminNodeServers.tsx';
import AdminNodeStatistics from './statistics/AdminNodeStatistics.tsx';
import AdminNodeTransfers from './transfers/AdminNodeTransfers.tsx';

export default function NodeView() {
  const { t } = useTranslations();
  const params = useParams<'id'>();

  const { data: node, isLoading } = useQuery({
    queryKey: queryKeys.admin.nodes.detail(params.id!),
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
            name: t('pages.admin.nodes.tabs.overview.title', {}),
            icon: faHouse,
            path: '/',
            element: <NodeOverview node={node} />,
          },
          {
            name: t('common.tabs.general', {}),
            icon: faCog,
            path: `/settings`,
            element: <NodeCreateOrUpdate contextNode={node} />,
          },
          {
            name: t('pages.admin.nodes.tabs.configuration.title', {}),
            icon: faPenRuler,
            path: `/configuration`,
            hidden: isNodeAIO(node),
            element: <AdminNodeConfiguration node={node} />,
          },
          {
            name: t('pages.admin.nodes.tabs.statistics.title', {}),
            icon: faInfoCircle,
            path: `/statistics`,
            element: <AdminNodeStatistics node={node} />,
          },
          {
            name: t('pages.admin.nodes.tabs.logs.title', {}),
            icon: faFileLines,
            path: `/logs`,
            element: <AdminNodeLogs node={node} />,
          },
          {
            name: t('pages.admin.nodes.tabs.allocations.title', {}),
            icon: faNetworkWired,
            path: `/allocations`,
            element: <AdminNodeAllocations node={node} />,
            permission: 'nodes.allocations',
          },
          {
            name: t('pages.admin.nodes.tabs.mounts.title', {}),
            icon: faFolderTree,
            path: `/mounts`,
            element: <AdminNodeMounts node={node} />,
            permission: 'nodes.mounts',
          },
          {
            name: t('pages.admin.nodes.tabs.backups.title', {}),
            icon: faArchive,
            path: `/backups`,
            element: <AdminNodeBackups node={node} />,
            permission: 'nodes.backups',
          },
          {
            name: t('pages.admin.nodes.tabs.servers.title', {}),
            icon: faComputer,
            path: `/servers`,
            element: <AdminNodeServers node={node} />,
            permission: 'servers.read',
          },
          {
            name: t('pages.admin.nodes.tabs.transfers.title', {}),
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
