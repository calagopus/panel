import { faCog, faUsers } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getRole from '@/api/admin/roles/getRole.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import SubNavigation from '@/elements/navigation/SubNavigation.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import RoleCreateOrUpdate from '@/pages/admin/roles/RoleCreateOrUpdate.tsx';
import AdminRoleUsers from '@/pages/admin/roles/users/AdminRoleUsers.tsx';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function RoleView() {
  const { t } = useTranslations();
  const { id } = useParams<'id'>();

  const resource = useResource({
    queryKey: queryKeys.admin.roles.detail(id!),
    queryFn: () => getRole(id!),
  });

  return (
    <ResourceView resource={resource}>
      {(role) => (
        <AdminContentContainer
          title={role.name}
          registry={window.extensionContext.extensionRegistry.pages.admin.roles.container}
        >
          <SubNavigation
            baseUrl={`/admin/roles/${id}`}
            registry={window.extensionContext.extensionRegistry.pages.admin.roles.view.subNavigation}
            registryProps={{ role }}
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
