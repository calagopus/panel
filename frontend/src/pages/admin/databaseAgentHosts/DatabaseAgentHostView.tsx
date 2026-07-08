import { faCog, faHouse, faInfoCircle, faPenRuler } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getDatabaseAgentHost from '@/api/admin/database-agent-hosts/getDatabaseAgentHost.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminDatabaseAgentHostConfiguration from './configuration/AdminDatabaseAgentHostConfiguration.tsx';
import DatabaseAgentHostCreateOrUpdate from './DatabaseAgentHostCreateOrUpdate.tsx';
import DatabaseAgentHostOverview from './overview/DatabaseAgentHostOverview.tsx';
import AdminDatabaseAgentHostStatistics from './statistics/AdminDatabaseAgentHostStatistics.tsx';

export default function DatabaseAgentHostView() {
  const { t } = useTranslations();
  const params = useParams<'id'>();

  const resource = useResource({
    queryKey: queryKeys.admin.databaseAgentHosts.detail(params.id!),
    queryFn: () => getDatabaseAgentHost(params.id!),
  });

  return (
    <ResourceView resource={resource}>
      {(databaseAgentHost) => (
        <AdminContentContainer title={databaseAgentHost.name}>
          <SubNavigation
            baseUrl={`/admin/database-agent-hosts/${params.id}`}
            items={[
              {
                name: t('pages.admin.databaseAgentHosts.tabs.overview.title', {}),
                icon: faHouse,
                path: `/`,
                element: <DatabaseAgentHostOverview databaseAgentHost={databaseAgentHost} />,
              },
              {
                name: t('common.tabs.general', {}),
                icon: faCog,
                path: `/settings`,
                element: <DatabaseAgentHostCreateOrUpdate contextDatabaseAgentHost={databaseAgentHost} />,
              },
              {
                name: t('pages.admin.databaseAgentHosts.tabs.configuration.title', {}),
                icon: faPenRuler,
                path: `/configuration`,
                element: <AdminDatabaseAgentHostConfiguration databaseAgentHost={databaseAgentHost} />,
              },
              {
                name: t('pages.admin.databaseAgentHosts.tabs.statistics.title', {}),
                icon: faInfoCircle,
                path: `/statistics`,
                element: <AdminDatabaseAgentHostStatistics databaseAgentHost={databaseAgentHost} />,
              },
            ]}
          />
        </AdminContentContainer>
      )}
    </ResourceView>
  );
}
