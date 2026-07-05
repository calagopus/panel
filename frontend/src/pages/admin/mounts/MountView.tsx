import { faCog, faComputer, faEgg, faServer } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getMount from '@/api/admin/mounts/getMount.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import MountCreateOrUpdate from '@/pages/admin/mounts/MountCreateOrUpdate.tsx';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminMountEggs from './eggs/AdminMountEggs.tsx';
import AdminMountNodes from './nodes/AdminMountNodes.tsx';
import AdminMountServers from './servers/AdminMountServers.tsx';

export default function MountView() {
  const { t } = useTranslations();
  const params = useParams<'id'>();

  const resource = useResource({
    queryKey: ['admin', 'mounts', { uuid: params.id }],
    queryFn: () => getMount(params.id!),
  });

  return (
    <ResourceView resource={resource}>
      {(mount) => (
        <AdminContentContainer title={mount.name}>
          <SubNavigation
            baseUrl={`/admin/mounts/${params.id}`}
            items={[
              {
                name: t('common.tabs.general', {}),
                icon: faCog,
                path: `/`,
                element: <MountCreateOrUpdate contextMount={mount} />,
              },
              {
                name: t('pages.admin.mounts.tabs.eggs.title', {}),
                icon: faEgg,
                path: `/eggs`,
                element: <AdminMountEggs mount={mount} />,
                permission: 'eggs.read',
              },
              {
                name: t('pages.admin.mounts.tabs.nodes.title', {}),
                icon: faServer,
                path: `/nodes`,
                element: <AdminMountNodes mount={mount} />,
                permission: 'nodes.read',
              },
              {
                name: t('pages.admin.mounts.tabs.servers.title', {}),
                icon: faComputer,
                path: `/servers`,
                element: <AdminMountServers mount={mount} />,
                permission: 'servers.read',
              },
            ]}
          />
        </AdminContentContainer>
      )}
    </ResourceView>
  );
}
