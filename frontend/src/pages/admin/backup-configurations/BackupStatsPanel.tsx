import type { z } from 'zod';
import type { backupStatsByPeriodSchema } from '@/api/admin/stats/getBackupStats.ts';
import Card from '@/elements/data-display/Card.tsx';
import TitleCard from '@/elements/data-display/TitleCard.tsx';
import Title from '@/elements/typography/Title.tsx';
import { bytesToString } from '@/lib/format/size.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const PERIODS = ['allTime', 'today', 'week', 'month'] as const;

export default function BackupStatsPanel({ stats }: { stats: z.infer<typeof backupStatsByPeriodSchema> }) {
  const { t } = useTranslations();

  return (
    <div className='flex flex-col 2xl:flex-row gap-4'>
      {PERIODS.map((period) => {
        const periodLabel = t(`pages.admin.backupConfigurations.tabs.stats.page.periodLabel.${period}`, {});
        const periodStats = stats[period];

        return (
          <TitleCard
            key={period}
            title={t(`pages.admin.backupConfigurations.tabs.stats.page.period.${period}`, {})}
            className='flex-1 min-w-0'
          >
            <div className='flex flex-col gap-4'>
              <Card>
                <Title order={3}>{periodStats.total}</Title>
                {t('pages.admin.backupConfigurations.tabs.stats.page.stat.total', { period: periodLabel })}
              </Card>
              <Card>
                <Title order={3}>
                  {periodStats.successful} ({bytesToString(periodStats.successfulBytes)})
                </Title>
                {t('pages.admin.backupConfigurations.tabs.stats.page.stat.successful', { period: periodLabel })}
              </Card>
              <Card>
                <Title order={3}>{periodStats.failed}</Title>
                {t('pages.admin.backupConfigurations.tabs.stats.page.stat.failed', { period: periodLabel })}
              </Card>
              <Card>
                <Title order={3}>
                  {periodStats.deleted} ({bytesToString(periodStats.deletedBytes)})
                </Title>
                {t('pages.admin.backupConfigurations.tabs.stats.page.stat.deleted', { period: periodLabel })}
              </Card>
            </div>
          </TitleCard>
        );
      })}
    </div>
  );
}
