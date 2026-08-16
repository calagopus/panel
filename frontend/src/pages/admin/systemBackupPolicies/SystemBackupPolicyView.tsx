import { faArchive, faCog, faDesktop, faEarthAmerica, faServer } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getSystemBackupPolicy from '@/api/admin/system-backup-policies/getSystemBackupPolicy.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import AdminSystemBackupPolicyBackups from '@/pages/admin/systemBackupPolicies/backups/AdminSystemBackupPolicyBackups.tsx';
import AdminSystemBackupPolicyLocations from '@/pages/admin/systemBackupPolicies/locations/AdminSystemBackupPolicyLocations.tsx';
import AdminSystemBackupPolicyNodes from '@/pages/admin/systemBackupPolicies/nodes/AdminSystemBackupPolicyNodes.tsx';
import AdminSystemBackupPolicyServers from '@/pages/admin/systemBackupPolicies/servers/AdminSystemBackupPolicyServers.tsx';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import SystemBackupPolicyCreateOrUpdate from './SystemBackupPolicyCreateOrUpdate.tsx';

export default function SystemBackupPolicyView() {
  const { t } = useTranslations();
  const params = useParams<'id'>();

  const resource = useResource({
    queryKey: queryKeys.admin.systemBackupPolicies.detail(params.id!),
    queryFn: () => getSystemBackupPolicy(params.id!),
  });

  return (
    <ResourceView resource={resource}>
      {(systemBackupPolicy) => (
        <AdminContentContainer
          title={systemBackupPolicy.name}
          registry={window.extensionContext.extensionRegistry.pages.admin.systemBackupPolicies.container}
        >
          <SubNavigation
            baseUrl={`/admin/system-backup-policies/${params.id}`}
            registry={window.extensionContext.extensionRegistry.pages.admin.systemBackupPolicies.view.subNavigation}
            registryProps={{ systemBackupPolicy }}
            items={[
              {
                name: t('common.tabs.general', {}),
                icon: faCog,
                path: `/`,
                element: <SystemBackupPolicyCreateOrUpdate contextSystemBackupPolicy={systemBackupPolicy} />,
              },
              {
                name: t('pages.admin.systemBackupPolicies.tabs.backups.title', {}),
                icon: faArchive,
                path: `/backups`,
                permission: 'system-backup-policies.backups',
                element: <AdminSystemBackupPolicyBackups systemBackupPolicy={systemBackupPolicy} />,
              },
              {
                name: t('pages.admin.systemBackupPolicies.tabs.locations.title', {}),
                icon: faEarthAmerica,
                path: `/locations`,
                permission: 'locations.read',
                element: <AdminSystemBackupPolicyLocations systemBackupPolicy={systemBackupPolicy} />,
              },
              {
                name: t('pages.admin.systemBackupPolicies.tabs.nodes.title', {}),
                icon: faServer,
                path: `/nodes`,
                permission: 'nodes.read',
                element: <AdminSystemBackupPolicyNodes systemBackupPolicy={systemBackupPolicy} />,
              },
              {
                name: t('pages.admin.systemBackupPolicies.tabs.servers.title', {}),
                icon: faDesktop,
                path: `/servers`,
                permission: 'servers.read',
                element: <AdminSystemBackupPolicyServers systemBackupPolicy={systemBackupPolicy} />,
              },
            ]}
          />
        </AdminContentContainer>
      )}
    </ResourceView>
  );
}
