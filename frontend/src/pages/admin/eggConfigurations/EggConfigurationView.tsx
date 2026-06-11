import { faCog } from '@fortawesome/free-solid-svg-icons';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import getEggConfiguration from '@/api/admin/egg-configurations/getEggConfiguration.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggConfigurationCreateOrUpdate from './EggConfigurationCreateOrUpdate.tsx';

export default function EggConfigurationView() {
  const params = useParams<'id'>();
  const { t } = useTranslations();

  const { data: eggConfiguration, isLoading } = useQuery({
    queryKey: ['admin', 'eggConfigurations', { uuid: params.id }],
    queryFn: () => getEggConfiguration(params.id!),
  });

  return isLoading || !eggConfiguration ? (
    <Spinner.Centered />
  ) : (
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
  );
}
