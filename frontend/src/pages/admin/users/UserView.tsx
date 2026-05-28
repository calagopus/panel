import { faBriefcase, faCog, faComputer, faFingerprint } from '@fortawesome/free-solid-svg-icons';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import getUser from '@/api/admin/users/getUser.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import AdminUserServers from '@/pages/admin/users/servers/AdminUserServers.tsx';
import UserCreateOrUpdate from '@/pages/admin/users/UserCreateOrUpdate.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import AdminUserActivity from './activity/AdminUserActivity.tsx';
import AdminUserOAuthLinks from './oauthLinks/AdminUserOAuthLinks.tsx';

export default function UserView() {
  const params = useParams<'id'>();
  const { t } = useTranslations();

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin', 'users', { uuid: params.id }],
    queryFn: () => getUser(params.id!),
  });

  return isLoading || !user ? (
    <Spinner.Centered />
  ) : (
    <AdminContentContainer title={user.username}>
      <SubNavigation
        baseUrl={`/admin/users/${params.id}`}
        items={[
          {
            name: t('common.tabs.general', {}),
            icon: faCog,
            path: `/`,
            element: <UserCreateOrUpdate contextUser={user} />,
          },
          {
            name: t('pages.admin.users.tabs.servers', {}),
            icon: faComputer,
            path: `/servers`,
            element: <AdminUserServers user={user} />,
            permission: 'servers.read',
          },
          {
            name: t('pages.admin.users.tabs.oauthLinks', {}),
            icon: faFingerprint,
            path: `/oauth-links`,
            element: <AdminUserOAuthLinks user={user} />,
            permission: 'users.oauth-links',
          },
          {
            name: t('pages.admin.users.tabs.activity', {}),
            icon: faBriefcase,
            path: `/activity`,
            element: <AdminUserActivity user={user} />,
            permission: 'users.activity',
          },
        ]}
      />
    </AdminContentContainer>
  );
}
