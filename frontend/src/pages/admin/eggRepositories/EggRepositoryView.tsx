import { faCog, faEgg } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getEggRepository from '@/api/admin/egg-repositories/getEggRepository.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggRepositoryCreateOrUpdate from './EggRepositoryCreateOrUpdate.tsx';
import EggRepositoryEggs from './eggs/EggRepositoryEggs.tsx';

export default function EggRepositoryView() {
  const { t } = useTranslations();
  const params = useParams<'eggRepositoryId'>();

  const { data: eggRepository, loading: isLoading } = useResource({
    queryKey: ['admin', 'eggRepositories', { uuid: params.eggRepositoryId }],
    queryFn: () => getEggRepository(params.eggRepositoryId!),
  });

  return isLoading || !eggRepository ? (
    <Spinner.Centered />
  ) : (
    <AdminContentContainer title={eggRepository.name}>
      <SubNavigation
        baseUrl={`/admin/egg-repositories/${params.eggRepositoryId}`}
        items={[
          {
            name: t('common.tabs.general', {}),
            icon: faCog,
            path: '/',
            element: <EggRepositoryCreateOrUpdate contextEggRepository={eggRepository} />,
          },
          {
            name: t('pages.admin.eggRepositories.tabs.eggs.title', {}),
            icon: faEgg,
            path: `/eggs`,
            element: <EggRepositoryEggs contextEggRepository={eggRepository} />,
          },
        ]}
      />
    </AdminContentContainer>
  );
}
