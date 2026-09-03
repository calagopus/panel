import {
  faArchive,
  faArrowUpLong,
  faCog,
  faComputer,
  faDatabase,
  faFileLines,
  faFolderTree,
  faHouse,
  faInfoCircle,
  faLayerGroup,
  faNetworkWired,
  faPenRuler,
  faShareNodes,
} from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getNode from '@/api/admin/nodes/getNode.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import SubNavigation from '@/elements/navigation/SubNavigation.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import { isNodeAIO } from '@/lib/domain/node.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminNodeAllocations from './allocations/AdminNodeAllocations.tsx';
import AdminNodeBackups from './backups/AdminNodeBackups.tsx';
import AdminNodeConfiguration from './configuration/AdminNodeConfiguration.tsx';
import AdminNodeDatabaseAgentHosts from './database-agent-hosts/AdminNodeDatabaseAgentHosts.tsx';
import AdminNodeDatabaseHosts from './database-hosts/AdminNodeDatabaseHosts.tsx';
import AdminNodeLogs from './logs/AdminNodeLogs.tsx';
import AdminNodeMounts from './mounts/AdminNodeMounts.tsx';
import NodeCreateOrUpdate from './NodeCreateOrUpdate.tsx';
import NodeOverview from './overview/NodeOverview.tsx';
import AdminNodeServers from './servers/AdminNodeServers.tsx';
import AdminNodeStatistics from './statistics/AdminNodeStatistics.tsx';
import AdminNodeTransfers from './transfers/AdminNodeTransfers.tsx';
import AdminNodeTunnel from './tunnel/AdminNodeTunnel.tsx';

export default function NodeView() {
  const { t } = useTranslations();
  const params = useParams<'id'>();

  const resource = useResource({
    queryKey: queryKeys.admin.nodes.detail(params.id!),
    queryFn: () => getNode(params.id!),
  });

  return (
    <ResourceView resource={resource}>
      {(node) => (
        <AdminContentContainer
          title={node.name}
          registry={window.extensionContext.extensionRegistry.pages.admin.nodes.container}
        >
          <SubNavigation
            baseUrl={`/admin/nodes/${params.id}`}
            registry={window.extensionContext.extensionRegistry.pages.admin.nodes.view.subNavigation}
            registryProps={{ node }}
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
                name: t('pages.admin.nodes.tabs.databaseHosts.title', {}),
                icon: faDatabase,
                path: `/database-hosts`,
                element: <AdminNodeDatabaseHosts node={node} />,
                permission: 'nodes.database-hosts',
              },
              {
                name: t('pages.admin.nodes.tabs.databaseAgentHosts.title', {}),
                icon: faLayerGroup,
                path: `/database-agent-hosts`,
                element: <AdminNodeDatabaseAgentHosts node={node} />,
                permission: 'nodes.database-agent-hosts',
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
              {
                name: t('pages.admin.nodes.tabs.tunnel.title', {}),
                icon: faShareNodes,
                path: `/tunnel`,
                hidden: isNodeAIO(node),
                element: <AdminNodeTunnel node={node} />,
                permission: 'nodes.tunnel',
              },
            ]}
          />
        </AdminContentContainer>
      )}
    </ResourceView>
  );
}
