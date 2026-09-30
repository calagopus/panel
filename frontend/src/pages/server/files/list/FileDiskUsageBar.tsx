import Card from '@/elements/data-display/Card.tsx';
import Progress from '@/elements/feedback/Progress.tsx';
import { bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { usageColor, usagePercent } from '@/lib/format/usage.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function FileDiskUsageBar() {
  const { t } = useTranslations();
  const diskLimit = useServerStore((state) => state.server.limits.disk);
  const diskBytes = useServerStore((state) => state.stats?.diskBytes ?? null);

  if (diskLimit === 0 || diskBytes === null) return null;

  const limitBytes = mbToBytes(diskLimit);
  const percentage = usagePercent(diskBytes, limitBytes) ?? 0;
  const color = usageColor(diskBytes, limitBytes);

  return (
    <Card mb='sm'>
      <div className='flex flex-col sm:flex-row sm:items-center w-full text-sm gap-1 sm:gap-0'>
        <div className='flex items-center justify-between gap-2 sm:contents'>
          <span className='shrink-0'>{t('common.stat.diskUsage', {})}</span>
          <span className='text-(--mantine-color-dimmed) sm:hidden'>
            {t('pages.server.files.diskUsage.details', {
              used: bytesToString(diskBytes),
              total: bytesToString(limitBytes),
              percentage: percentage.toFixed(1),
            })}
          </span>
        </div>
        <Progress hourglass={false} value={percentage} color={color} className='flex-1 sm:mx-2' />
        <span className='hidden sm:inline text-(--mantine-color-dimmed)'>
          {t('pages.server.files.diskUsage.details', {
            used: bytesToString(diskBytes),
            total: bytesToString(limitBytes),
            percentage: percentage.toFixed(1),
          })}
        </span>
      </div>
    </Card>
  );
}
