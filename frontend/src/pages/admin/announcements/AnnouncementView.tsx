import { faCog } from '@fortawesome/free-solid-svg-icons';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import getAnnouncement from '@/api/admin/announcements/getAnnouncement.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AnnouncementCreateOrUpdate from './AnnouncementCreateOrUpdate.tsx';

export default function AnnouncementView() {
  const params = useParams<'id'>();
  const { t } = useTranslations();

  const { data: announcement, isLoading } = useQuery({
    queryKey: ['admin', 'announcements', { uuid: params.id }],
    queryFn: () => getAnnouncement(params.id!),
  });

  return isLoading || !announcement ? (
    <Spinner.Centered />
  ) : (
    <AdminContentContainer title={announcement.title}>
      <SubNavigation
        baseUrl={`/admin/announcements/${params.id}`}
        items={[
          {
            name: t('common.tabs.general', {}),
            icon: faCog,
            path: '/',
            element: <AnnouncementCreateOrUpdate contextAnnouncement={announcement} />,
          },
        ]}
      />
    </AdminContentContainer>
  );
}
