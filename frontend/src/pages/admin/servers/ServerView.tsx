import {
  faArchive,
  faCodeCommit,
  faCog,
  faExternalLink,
  faFileText,
  faFolderTree,
  faHouse,
  faNetworkWired,
  faWrench,
} from '@fortawesome/free-solid-svg-icons';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import getServer from '@/api/admin/servers/getServer.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import AdminServerAllocations from '@/pages/admin/servers/allocations/AdminServerAllocations.tsx';
import AdminServerBackups from '@/pages/admin/servers/backups/AdminServerBackups.tsx';
import AdminServerLogs from '@/pages/admin/servers/logs/AdminServerLogs.tsx';
import AdminServerManagement from '@/pages/admin/servers/management/AdminServerManagement.tsx';
import AdminServerMounts from '@/pages/admin/servers/mounts/AdminServerMounts.tsx';
import ServerOverview from '@/pages/admin/servers/ServerOverview.tsx';
import ServerUpdate from '@/pages/admin/servers/ServerUpdate.tsx';
import AdminServerVariables from '@/pages/admin/servers/variables/AdminServerVariables.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function ServerView() {
  const { t } = useTranslations();
  const params = useParams<'id'>();

  const { data: server, isLoading } = useQuery({
    queryKey: ['admin', 'servers', { uuid: params.id }],
    queryFn: () => getServer(params.id!),
  });

  return isLoading || !server ? (
    <Spinner.Centered />
  ) : (
    <AdminContentContainer
      title={server.name}
      registry={window.extensionContext.extensionRegistry.pages.admin.servers.container}
    >
      <SubNavigation
        baseUrl={`/admin/servers/${params.id}`}
        items={[
          {
            name: t('pages.admin.servers.tabs.overview.title', {}),
            icon: faHouse,
            path: '/',
            element: <ServerOverview server={server} />,
          },
          {
            name: t('common.tabs.general', {}),
            icon: faCog,
            path: `/settings`,
            element: <ServerUpdate contextServer={server} />,
          },
          {
            name: t('pages.admin.servers.tabs.allocations.title', {}),
            icon: faNetworkWired,
            path: `/allocations`,
            element: <AdminServerAllocations server={server} />,
            permission: 'servers.allocations',
          },
          {
            name: t('pages.admin.servers.tabs.variables.title', {}),
            icon: faCodeCommit,
            path: `/variables`,
            element: <AdminServerVariables server={server} />,
            permission: 'servers.variables',
          },
          {
            name: t('pages.admin.servers.tabs.mounts.title', {}),
            icon: faFolderTree,
            path: `/mounts`,
            element: <AdminServerMounts server={server} />,
            permission: 'servers.mounts',
          },
          {
            name: t('pages.admin.servers.tabs.backups.title', {}),
            icon: faArchive,
            path: `/backups`,
            element: <AdminServerBackups server={server} />,
            permission: 'nodes.backups',
          },
          {
            name: t('pages.admin.servers.tabs.logs.title', {}),
            icon: faFileText,
            path: `/logs`,
            element: <AdminServerLogs server={server} />,
            permission: 'servers.read',
          },
          {
            name: t('pages.admin.servers.tabs.management.title', {}),
            icon: faWrench,
            path: `/management`,
            element: <AdminServerManagement server={server} />,
          },
          {
            name: t('pages.admin.servers.tabs.viewClient.title', {}),
            icon: faExternalLink,
            link: `/server/${server.uuidShort}`,
            permission: 'servers.read',
          },
        ]}
        registry={window.extensionContext.extensionRegistry.pages.admin.servers.view.subNavigation}
        registryProps={{ server }}
      />
    </AdminContentContainer>
  );
}
