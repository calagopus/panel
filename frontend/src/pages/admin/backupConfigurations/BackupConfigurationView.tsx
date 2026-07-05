import { faArchive, faChartBar, faCog, faDesktop, faEarthAmerica, faServer } from '@fortawesome/free-solid-svg-icons';
import { useParams } from 'react-router';
import getBackupConfiguration from '@/api/admin/backup-configurations/getBackupConfiguration.ts';
import AdminContentContainer from '@/elements/containers/AdminContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import SubNavigation from '@/elements/SubNavigation.tsx';
import AdminBackupConfigurationLocations from '@/pages/admin/backupConfigurations/locations/AdminBackupConfigurationLocations.tsx';
import AdminBackupConfigurationNodes from '@/pages/admin/backupConfigurations/nodes/AdminBackupConfigurationNodes.tsx';
import AdminBackupConfigurationServers from '@/pages/admin/backupConfigurations/servers/AdminBackupConfigurationServers.tsx';
import AdminBackupConfigurationStats from '@/pages/admin/backupConfigurations/stats/AdminBackupConfigurationStats.tsx';
import { useResource } from '@/plugins/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import BackupConfigurationCreateOrUpdate from './BackupConfigurationCreateOrUpdate.tsx';
import AdminBackupConfigurationBackups from './backups/AdminBackupConfigurationBackups.tsx';

export default function BackupConfigurationView() {
  const { t } = useTranslations();
  const params = useParams<'id'>();

  const { data: backupConfiguration, loading: isLoading } = useResource({
    queryKey: ['admin', 'backupConfigurations', { uuid: params.id }],
    queryFn: () => getBackupConfiguration(params.id!),
  });

  return isLoading || !backupConfiguration ? (
    <Spinner.Centered />
  ) : (
    <AdminContentContainer title={backupConfiguration.name}>
      <SubNavigation
        baseUrl={`/admin/backup-configurations/${params.id}`}
        items={[
          {
            name: t('common.tabs.general', {}),
            icon: faCog,
            path: `/`,
            element: <BackupConfigurationCreateOrUpdate contextBackupConfiguration={backupConfiguration} />,
          },
          {
            name: t('pages.admin.backupConfigurations.tabs.stats.title', {}),
            icon: faChartBar,
            path: `/stats`,
            element: <AdminBackupConfigurationStats backupConfiguration={backupConfiguration} />,
          },
          {
            name: t('pages.admin.backupConfigurations.tabs.backups.title', {}),
            icon: faArchive,
            path: `/backups`,
            permission: 'backup-configurations.backups',
            element: <AdminBackupConfigurationBackups backupConfiguration={backupConfiguration} />,
          },
          {
            name: t('pages.admin.backupConfigurations.tabs.locations.title', {}),
            icon: faEarthAmerica,
            path: `/locations`,
            permission: 'locations.read',
            element: <AdminBackupConfigurationLocations backupConfiguration={backupConfiguration} />,
          },
          {
            name: t('pages.admin.backupConfigurations.tabs.nodes.title', {}),
            icon: faServer,
            path: `/nodes`,
            permission: 'nodes.read',
            element: <AdminBackupConfigurationNodes backupConfiguration={backupConfiguration} />,
          },
          {
            name: t('pages.admin.backupConfigurations.tabs.servers.title', {}),
            icon: faDesktop,
            path: `/servers`,
            permission: 'servers.read',
            element: <AdminBackupConfigurationServers backupConfiguration={backupConfiguration} />,
          },
        ]}
      />
    </AdminContentContainer>
  );
}
