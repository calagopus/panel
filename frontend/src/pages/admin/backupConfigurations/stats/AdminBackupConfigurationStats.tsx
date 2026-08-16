import { faArchive } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Fragment, useEffect, useState } from 'react';
import { z } from 'zod';
import getBackupConfigurationStats, {
  type BackupStats,
} from '@/api/admin/backup-configurations/getBackupConfigurationStats.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import Card from '@/elements/Card.tsx';
import AdminSubContentContainer from '@/elements/containers/AdminSubContentContainer.tsx';
import Spinner from '@/elements/Spinner.tsx';
import Title from '@/elements/Title.tsx';
import TitleCard from '@/elements/TitleCard.tsx';
import { adminBackupConfigurationSchema } from '@/lib/schemas/admin/backupConfigurations.ts';
import { bytesToString } from '@/lib/size.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export default function AdminBackupConfigurationStats({
  backupConfiguration,
}: {
  backupConfiguration: z.infer<typeof adminBackupConfigurationSchema>;
}) {
  const { t } = useTranslations();
  const { addToast } = useToast();

  const [stats, setStats] = useState<Record<'allTime' | 'today' | 'week' | 'month', BackupStats> | null>(null);

  useEffect(() => {
    getBackupConfigurationStats(backupConfiguration.uuid)
      .then((data) => {
        setStats(data);
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      });
  }, []);

  return (
    <AdminSubContentContainer
      title={t('pages.admin.backupConfigurations.tabs.stats.page.title', {})}
      titleOrder={2}
      registry={window.extensionContext.extensionRegistry.pages.admin.backupConfigurations.view.stats.subContainer}
      registryProps={{ backupConfiguration }}
    >
      {!stats ? (
        <Spinner.Centered />
      ) : (
        <TitleCard
          title={t('pages.admin.backupConfigurations.tabs.stats.page.card.title', {})}
          icon={<FontAwesomeIcon icon={faArchive} />}
          className='mt-4'
        >
          <div className='flex flex-col 2xl:flex-row gap-4'>
            {(['allTime', 'today', 'week', 'month'] as const).map((period) => {
              const periodLabel = t(`pages.admin.backupConfigurations.tabs.stats.page.periodLabel.${period}`, {});

              return (
                <Fragment key={period}>
                  <TitleCard
                    title={t(`pages.admin.backupConfigurations.tabs.stats.page.period.${period}`, {})}
                    className='flex-1 min-w-0'
                  >
                    <div className='flex flex-col gap-4'>
                      <Card>
                        <Title order={3}>{stats[period].total}</Title>
                        {t('pages.admin.backupConfigurations.tabs.stats.page.stat.total', { period: periodLabel })}
                      </Card>
                      <Card>
                        <Title order={3}>
                          {stats[period].successful} ({bytesToString(stats[period].successfulBytes)})
                        </Title>
                        {t('pages.admin.backupConfigurations.tabs.stats.page.stat.successful', { period: periodLabel })}
                      </Card>
                      <Card>
                        <Title order={3}>{stats[period].failed}</Title>
                        {t('pages.admin.backupConfigurations.tabs.stats.page.stat.failed', { period: periodLabel })}
                      </Card>
                      <Card>
                        <Title order={3}>
                          {stats[period].deleted} ({bytesToString(stats[period].deletedBytes)})
                        </Title>
                        {t('pages.admin.backupConfigurations.tabs.stats.page.stat.deleted', { period: periodLabel })}
                      </Card>
                    </div>
                  </TitleCard>
                </Fragment>
              );
            })}
          </div>
        </TitleCard>
      )}
    </AdminSubContentContainer>
  );
}
