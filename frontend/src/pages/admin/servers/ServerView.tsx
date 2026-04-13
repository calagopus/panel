import {
  faCodeCommit,
  faCog,
  faExternalLink,
  faFileText,
  faFolderTree,
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
import AdminServerLogs from '@/pages/admin/servers/logs/AdminServerLogs.tsx';
import AdminServerManagement from '@/pages/admin/servers/management/AdminServerManagement.tsx';
import AdminServerMounts from '@/pages/admin/servers/mounts/AdminServerMounts.tsx';
import ServerUpdate from '@/pages/admin/servers/ServerUpdate.tsx';
import AdminServerVariables from '@/pages/admin/servers/variables/AdminServerVariables.tsx';

export default function ServerView() {
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
            name: 'General',
            icon: faCog,
            path: '/',
            element: <ServerUpdate contextServer={server} />,
          },
          {
            name: 'Allocations',
            icon: faNetworkWired,
            path: `/allocations`,
            element: <AdminServerAllocations server={server} />,
            permission: 'servers.allocations',
          },
          {
            name: 'Variables',
            icon: faCodeCommit,
            path: `/variables`,
            element: <AdminServerVariables server={server} />,
            permission: 'servers.variables',
          },
          {
            name: 'Mounts',
            icon: faFolderTree,
            path: `/mounts`,
            element: <AdminServerMounts server={server} />,
            permission: 'servers.mounts',
          },
          {
            name: 'Logs',
            icon: faFileText,
            path: `/logs`,
            element: <AdminServerLogs server={server} />,
            permission: 'servers.read',
          },
          {
            name: 'Management',
            icon: faWrench,
            path: `/management`,
            element: <AdminServerManagement server={server} />,
          },
          {
            name: 'View',
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
