import { faArchive } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { z } from 'zod';
import getBackupConfigurationStats from '@/api/admin/backup-configurations/getBackupConfigurationStats.ts';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import ResourceView from '@/elements/ResourceView.tsx';
import { queryKeys } from '@/lib/queryKeys.ts';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import BackupStatsPanel from '../BackupStatsPanel.tsx';

export default function AdminBackupConfigurationStats({
  backupConfiguration,
}: {
  backupConfiguration: z.infer<typeof adminBackupConfigurationSchema>;
}) {
  const { t } = useTranslations();

  const resource = useResource({
    queryKey: queryKeys.admin.backupConfigurations.stats(backupConfiguration.uuid),
    queryFn: () => getBackupConfigurationStats(backupConfiguration.uuid),
  });

  return (
    <AdminSubContentContainer
      title={t('pages.admin.backupConfigurations.tabs.stats.page.title', {})}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.backupConfigurations.view.stats.subContainer}
      registryProps={{ backupConfiguration }}
    >
      <ResourceView resource={resource}>
        {(stats) => (
          <TitleCard
            title={t('pages.admin.backupConfigurations.tabs.stats.page.card.title', {})}
            icon={<FontAwesomeIcon icon={faArchive} />}
            className='mt-4'
          >
            <BackupStatsPanel stats={stats} />
          </TitleCard>
        )}
      </ResourceView>
    </AdminSubContentContainer>
  );
}
