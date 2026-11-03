import {
  faArrowDown,
  faArrowUp,
  faCloudDownload,
  faHardDrive,
  faMemory,
  faMicrochip,
  faPowerOff,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { ResourceHistoryProps } from 'shared/src/registries/pages/server/console/history.ts';
import StatCard from '@/elements/data-display/StatCard.tsx';
import { formatBytes, formatPercent } from '@/lib/chart.ts';
import { bytesToString } from '@/lib/format/size.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export function HistoryUptimeCard({ summary, loading }: ResourceHistoryProps) {
  const { t } = useTranslations();

  return (
    <StatCard
      icon={faPowerOff}
      label={t('common.stat.uptime', {})}
      value={summary.uptime === null ? t('common.na', {}) : formatPercent(summary.uptime * 100)}
      loading={loading && summary.uptime === null}
    />
  );
}

export function HistoryCpuCard({ summary, loading }: ResourceHistoryProps) {
  const { t } = useTranslations();

  return (
    <StatCard
      icon={faMicrochip}
      label={t('common.stat.cpu', {})}
      value={summary.cpuAverage === null ? t('common.na', {}) : formatPercent(summary.cpuAverage)}
      details={
        summary.cpuMax === null
          ? null
          : t('pages.server.console.history.summary.peak', { value: formatPercent(summary.cpuMax) })
      }
      loading={loading && summary.cpuAverage === null}
    />
  );
}

export function HistoryMemoryCard({ summary, loading }: ResourceHistoryProps) {
  const { t } = useTranslations();

  return (
    <StatCard
      icon={faMemory}
      label={t('common.stat.memoryUsage', {})}
      value={summary.memoryAverage === null ? t('common.na', {}) : formatBytes(summary.memoryAverage)}
      details={
        summary.memoryMax === null
          ? null
          : t('pages.server.console.history.summary.peak', { value: formatBytes(summary.memoryMax) })
      }
      loading={loading && summary.memoryAverage === null}
    />
  );
}

export function HistoryNetworkCard({ summary, loading }: ResourceHistoryProps) {
  const { t } = useTranslations();

  return (
    <StatCard
      icon={faCloudDownload}
      label={t('common.stat.network', {})}
      value={
        summary.networkRxBytes === null || summary.networkTxBytes === null ? (
          t('common.na', {})
        ) : (
          <span className='inline-flex items-center gap-2'>
            <span className='inline-flex items-center gap-1'>
              <FontAwesomeIcon
                icon={faArrowDown}
                size='xs'
                className='text-(--mantine-color-dimmed)'
                title={t('common.stat.inbound', {})}
              />
              {bytesToString(summary.networkRxBytes, 1, true)}
            </span>
            <span className='inline-flex items-center gap-1'>
              <FontAwesomeIcon
                icon={faArrowUp}
                size='xs'
                className='text-(--mantine-color-dimmed)'
                title={t('common.stat.outbound', {})}
              />
              {bytesToString(summary.networkTxBytes, 1, true)}
            </span>
          </span>
        )
      }
      loading={loading && summary.networkRxBytes === null}
    />
  );
}

export function HistoryDiskCard({ summary, loading }: ResourceHistoryProps) {
  const { t } = useTranslations();

  return (
    <StatCard
      icon={faHardDrive}
      label={t('common.stat.diskUsage', {})}
      value={summary.disk === null ? t('common.na', {}) : formatBytes(summary.disk)}
      loading={loading && summary.disk === null}
    />
  );
}
