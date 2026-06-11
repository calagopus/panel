import { faCog, faEgg } from '@fortawesome/free-solid-svg-icons';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import getEggRepository from '@/api/admin/egg-repositories/getEggRepository.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggRepositoryCreateOrUpdate from './EggRepositoryCreateOrUpdate.tsx';
import EggRepositoryEggs from './eggs/EggRepositoryEggs.tsx';

export default function EggRepositoryView() {
  const { t } = useTranslations();
  const params = useParams<'eggRepositoryId'>();

  const { data: eggRepository, isLoading } = useQuery({
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
