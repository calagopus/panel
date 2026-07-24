import { faCog, faDatabase } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getDatabaseAgentTemplate from '@/api/admin/database-agent-templates/getDatabaseAgentTemplate.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import DatabaseAgentTemplateCreateOrUpdate from './DatabaseAgentTemplateCreateOrUpdate.tsx';
import AdminDatabaseAgentTemplateInstances from './instances/AdminDatabaseAgentTemplateInstances.tsx';

export default function DatabaseAgentTemplateView() {
  const { t } = useTranslations();
  const params = useParams<'id'>();

  const resource = useResource({
    queryKey: queryKeys.admin.databaseAgentTemplates.detail(params.id!),
    queryFn: () => getDatabaseAgentTemplate(params.id!),
  });

  return (
    <ResourceView resource={resource}>
      {(databaseAgentTemplate) => (
        <AdminContentContainer
          title={databaseAgentTemplate.name}
          registry={window.extensionContext.extensionRegistry.pages.admin.databaseAgentTemplates.container}
        >
          <SubNavigation
            baseUrl={`/admin/database-agent-templates/${params.id}`}
            registry={window.extensionContext.extensionRegistry.pages.admin.databaseAgentTemplates.view.subNavigation}
            registryProps={{ databaseAgentTemplate }}
            items={[
              {
                name: t('common.tabs.general', {}),
                icon: faCog,
                path: `/`,
                element: <DatabaseAgentTemplateCreateOrUpdate contextDatabaseAgentTemplate={databaseAgentTemplate} />,
              },
              {
                name: t('pages.admin.databaseAgentTemplates.tabs.instances.title', {}),
                icon: faDatabase,
                path: `/instances`,
                element: <AdminDatabaseAgentTemplateInstances databaseAgentTemplate={databaseAgentTemplate} />,
              },
            ]}
          />
        </AdminContentContainer>
      )}
    </ResourceView>
  );
}
