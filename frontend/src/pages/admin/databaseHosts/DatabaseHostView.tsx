import { faCog, faDatabase } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getDatabaseHost from '@/api/admin/database-hosts/getDatabaseHost.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import AdminDatabaseHostDatabases from '@/pages/admin/databaseHosts/databases/AdminDatabaseHostDatabases.tsx';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseHostCreateOrUpdate from './DatabaseHostCreateOrUpdate.tsx';

export default function DatabaseHostView() {
  const { t } = useTranslations();
  const params = useParams<'id'>();

  const resource = useResource({
    queryKey: ['admin', 'databaseHosts', { uuid: params.id }],
    queryFn: () => getDatabaseHost(params.id!),
  });

  return (
    <ResourceView resource={resource}>
      {(databaseHost) => (
        <AdminContentContainer
          title={databaseHost.name}
          registry={window.extensionContext.extensionRegistry.pages.admin.databaseHosts.container}
        >
          <SubNavigation
            baseUrl={`/admin/database-hosts/${params.id}`}
            registry={window.extensionContext.extensionRegistry.pages.admin.databaseHosts.view.subNavigation}
            registryProps={{ databaseHost }}
            items={[
              {
                name: t('common.tabs.general', {}),
                icon: faCog,
                path: `/`,
                element: <DatabaseHostCreateOrUpdate contextDatabaseHost={databaseHost} />,
              },
              {
                name: t('pages.admin.databaseHosts.tabs.databases.title', {}),
                icon: faDatabase,
                path: `/databases`,
                element: <AdminDatabaseHostDatabases databaseHost={databaseHost} />,
              },
            ]}
          />
        </AdminContentContainer>
      )}
    </ResourceView>
  );
}
