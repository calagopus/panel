import { faCog, faUsers } from '@fortawesome/free-solid-svg-icons';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import getOAuthProvider from '@/api/admin/oauth-providers/getOAuthProvider.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import AdminOAuthProviderUsers from '@/pages/admin/oAuthProviders/users/AdminOAuthProviderUsers.tsx';
import OAuthProviderCreateOrUpdate from './OAuthProviderCreateOrUpdate.tsx';

export default function OAuthProviderView() {
  const params = useParams<'id'>();

  const { data: oauthProvider, isLoading } = useQuery({
    queryKey: ['admin', 'oauthProviders', { uuid: params.id }],
    queryFn: () => getOAuthProvider(params.id!),
  });

  return isLoading || !oauthProvider ? (
    <Spinner.Centered />
  ) : (
    <AdminContentContainer title={oauthProvider.name}>
      <SubNavigation
        baseUrl={`/admin/oauth-providers/${params.id}`}
        items={[
          {
            name: 'General',
            icon: faCog,
            path: '/',
            element: <OAuthProviderCreateOrUpdate contextOAuthProvider={oauthProvider} />,
          },
          {
            name: 'Users',
            icon: faUsers,
            path: `/users`,
            element: <AdminOAuthProviderUsers oauthProvider={oauthProvider} />,
            permission: 'users.read',
          },
        ]}
      />
    </AdminContentContainer>
  );
}
