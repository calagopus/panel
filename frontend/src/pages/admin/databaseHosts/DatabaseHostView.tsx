import { faCog, faDatabase } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getDatabaseHost from '@/api/admin/database-hosts/getDatabaseHost.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import AdminDatabaseHostDatabases from '@/pages/admin/databaseHosts/databases/AdminDatabaseHostDatabases.tsx';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseHostCreateOrUpdate from './DatabaseHostCreateOrUpdate.tsx';

export default function DatabaseHostView() {
  const { t } = useTranslations();
  const params = useParams<'id'>();

  const { data: databaseHost, loading: isLoading } = useResource({
    queryKey: ['admin', 'databaseHosts', { uuid: params.id }],
    queryFn: () => getDatabaseHost(params.id!),
  });

  return isLoading || !databaseHost ? (
    <Spinner.Centered />
  ) : (
    <AdminContentContainer title={databaseHost.name}>
      <SubNavigation
        baseUrl={`/admin/database-hosts/${params.id}`}
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
  );
}
