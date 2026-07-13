import { faCog, faDatabase, faLayerGroup, faServer } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getLocation from '@/api/admin/locations/getLocation.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminLocationDatabaseAgentHosts from './database-agent-hosts/AdminLocationDatabaseAgentHosts.tsx';
import AdminLocationDatabaseHosts from './database-hosts/AdminLocationDatabaseHosts.tsx';
import LocationCreateOrUpdate from './LocationCreateOrUpdate.tsx';
import AdminLocationNodes from './nodes/AdminLocationNodes.tsx';

export default () => {
  const { t } = useTranslations();
  const params = useParams<'id'>();

  const resource = useResource({
    queryKey: ['admin', 'locations', { uuid: params.id }],
    queryFn: () => getLocation(params.id!),
  });

  return (
    <ResourceView resource={resource}>
      {(location) => (
        <AdminContentContainer title={location.name}>
          <SubNavigation
            baseUrl={`/admin/locations/${params.id}`}
            items={[
              {
                name: t('common.tabs.general', {}),
                icon: faCog,
                path: '/',
                element: <LocationCreateOrUpdate contextLocation={location} />,
              },
              {
                name: t('pages.admin.locations.tabs.databaseHosts.title', {}),
                icon: faDatabase,
                path: `/database-hosts`,
                element: <AdminLocationDatabaseHosts location={location} />,
                permission: 'locations.database-hosts',
              },
              {
                name: t('pages.admin.locations.tabs.databaseAgentHosts.title', {}),
                icon: faLayerGroup,
                path: `/database-agent-hosts`,
                element: <AdminLocationDatabaseAgentHosts location={location} />,
                permission: 'locations.database-agent-hosts',
              },
              {
                name: t('pages.admin.locations.tabs.nodes.title', {}),
                icon: faServer,
                path: `/nodes`,
                element: <AdminLocationNodes location={location} />,
                permission: 'nodes.read',
              },
            ]}
          />
        </AdminContentContainer>
      )}
    </ResourceView>
  );
};
