import { faCog, faSitemap, faUsers } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getOAuthProvider from '@/api/admin/oauth-providers/getOAuthProvider.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import AdminOAuthProviderMappings from '@/pages/admin/oAuthProviders/mappings/AdminOAuthProviderMappings.tsx';
import AdminOAuthProviderUsers from '@/pages/admin/oAuthProviders/users/AdminOAuthProviderUsers.tsx';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import OAuthProviderCreateOrUpdate from './OAuthProviderCreateOrUpdate.tsx';

export default function OAuthProviderView() {
  const params = useParams<'id'>();
  const { t } = useTranslations();

  const { data: oauthProvider, loading: isLoading } = useResource({
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
            name: t('common.tabs.general', {}),
            icon: faCog,
            path: '/',
            element: <OAuthProviderCreateOrUpdate contextOAuthProvider={oauthProvider} />,
          },
          {
            name: t('pages.admin.oAuthProviders.tabs.mappings.title', {}),
            icon: faSitemap,
            path: `/mappings`,
            element: <AdminOAuthProviderMappings oauthProvider={oauthProvider} />,
          },
          {
            name: t('pages.admin.oAuthProviders.tabs.users.title', {}),
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
