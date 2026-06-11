import { faCog, faEgg } from '@fortawesome/free-solid-svg-icons';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import getNest from '@/api/admin/nests/getNest.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminEggs from './eggs/AdminEggs.tsx';
import NestCreateOrUpdate from './NestCreateOrUpdate.tsx';

export default function NestView() {
  const params = useParams<'nestId'>();
  const { t } = useTranslations();

  const { data: nest, isLoading } = useQuery({
    queryKey: ['admin', 'nests', { uuid: params.nestId }],
    queryFn: () => getNest(params.nestId!),
  });

  return isLoading || !nest ? (
    <Spinner.Centered />
  ) : (
    <AdminContentContainer title={nest.name}>
      <SubNavigation
        baseUrl={`/admin/nests/${params.nestId}`}
        items={[
          {
            name: t('common.tabs.general', {}),
            icon: faCog,
            path: '/',
            element: <NestCreateOrUpdate contextNest={nest} />,
          },
          {
            name: t('pages.admin.nests.tabs.eggs.title', {}),
            icon: faEgg,
            path: '/eggs/*',
            element: <AdminEggs contextNest={nest} />,
            permission: 'eggs.read',
          },
        ]}
      />
    </AdminContentContainer>
  );
}
