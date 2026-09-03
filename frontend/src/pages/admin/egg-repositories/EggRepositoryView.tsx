import { faCog, faEgg } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getEggRepository from '@/api/admin/egg-repositories/getEggRepository.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import SubNavigation from '@/elements/navigation/SubNavigation.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import EggRepositoryCreateOrUpdate from './EggRepositoryCreateOrUpdate.tsx';
import EggRepositoryEggs from './eggs/EggRepositoryEggs.tsx';

export default function EggRepositoryView() {
  const { t } = useTranslations();
  const params = useParams<'eggRepositoryId'>();

  const resource = useResource({
    queryKey: queryKeys.admin.eggRepositories.detail(params.eggRepositoryId!),
    queryFn: () => getEggRepository(params.eggRepositoryId!),
  });

  return (
    <ResourceView resource={resource}>
      {(eggRepository) => (
        <AdminContentContainer
          title={eggRepository.name}
          registry={window.extensionContext.extensionRegistry.pages.admin.eggRepositories.container}
        >
          <SubNavigation
            baseUrl={`/admin/egg-repositories/${params.eggRepositoryId}`}
            registry={window.extensionContext.extensionRegistry.pages.admin.eggRepositories.view.subNavigation}
            registryProps={{ eggRepository }}
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
      )}
    </ResourceView>
  );
}
