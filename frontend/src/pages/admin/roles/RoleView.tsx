import { faCog, faUsers } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getRole from '@/api/admin/roles/getRole.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import RoleCreateOrUpdate from '@/pages/admin/roles/RoleCreateOrUpdate.tsx';
import AdminRoleUsers from '@/pages/admin/roles/users/AdminRoleUsers.tsx';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function RoleView() {
  const { t } = useTranslations();
  const params = useParams<'id'>();

  const resource = useResource({
    queryKey: ['admin', 'roles', { uuid: params.id }],
    queryFn: () => getRole(params.id!),
  });

  return (
    <ResourceView resource={resource}>
      {(role) => (
        <AdminContentContainer title={role.name}>
          <SubNavigation
            baseUrl={`/admin/roles/${params.id}`}
            items={[
              {
                name: t('common.tabs.general', {}),
                icon: faCog,
                path: `/`,
                element: <RoleCreateOrUpdate contextRole={role} />,
              },
              {
                name: t('pages.admin.roles.tabs.users.title', {}),
                icon: faUsers,
                path: `/users`,
                element: <AdminRoleUsers role={role} />,
                permission: 'users.read',
              },
            ]}
          />
        </AdminContentContainer>
      )}
    </ResourceView>
  );
}
