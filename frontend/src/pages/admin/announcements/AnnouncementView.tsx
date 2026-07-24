import { faCog } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getAnnouncement from '@/api/admin/announcements/getAnnouncement.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AnnouncementCreateOrUpdate from './AnnouncementCreateOrUpdate.tsx';

export default function AnnouncementView() {
  const params = useParams<'id'>();
  const { t } = useTranslations();

  const resource = useResource({
    queryKey: ['admin', 'announcements', { uuid: params.id }],
    queryFn: () => getAnnouncement(params.id!),
  });

  return (
    <ResourceView resource={resource}>
      {(announcement) => (
        <AdminContentContainer
          title={announcement.title}
          registry={window.extensionContext.extensionRegistry.pages.admin.announcements.container}
        >
          <SubNavigation
            baseUrl={`/admin/announcements/${params.id}`}
            registry={window.extensionContext.extensionRegistry.pages.admin.announcements.view.subNavigation}
            registryProps={{ announcement }}
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
      )}
    </ResourceView>
  );
}
