import { faCog } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getEggConfiguration from '@/api/admin/egg-configurations/getEggConfiguration.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggConfigurationCreateOrUpdate from './EggConfigurationCreateOrUpdate.tsx';

export default function EggConfigurationView() {
  const params = useParams<'id'>();
  const { t } = useTranslations();

  const resource = useResource({
    queryKey: queryKeys.admin.eggConfigurations.detail(params.id!),
    queryFn: () => getEggConfiguration(params.id!),
  });

  return (
    <ResourceView resource={resource}>
      {(eggConfiguration) => (
        <AdminContentContainer title={eggConfiguration.name}>
          <SubNavigation
            baseUrl={`/admin/egg-configurations/${params.id}`}
            items={[
              {
                name: t('common.tabs.general', {}),
                icon: faCog,
                path: `/`,
                element: <EggConfigurationCreateOrUpdate contextEggConfiguration={eggConfiguration} />,
              },
            ]}
          />
        </AdminContentContainer>
      )}
    </ResourceView>
  );
}
