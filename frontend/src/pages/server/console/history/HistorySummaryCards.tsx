import type { ResourceHistoryProps } from 'shared/src/registries/pages/server/console/history.ts';
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
import SummaryTile from '@/elements/data-display/SummaryTile.tsx';
import { formatBytes, formatPercent } from '@/lib/chart.ts';
import { bytesToString } from '@/lib/format/size.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export function HistoryUptimeCard({ summary, loading }: ResourceHistoryProps) {
  const { t } = useTranslations();

  return (
    <SummaryTile
      icon={faPowerOff}
      label={t('common.stat.uptime', {})}
      value={summary.uptime === null ? t('common.na', {}) : formatPercent(summary.uptime * 100)}
      caption={summary.uptime === null ? null : t('pages.server.console.history.summary.running', {})}
      loading={loading && summary.uptime === null}
    />
  );
}

export function HistoryCpuCard({ summary, loading }: ResourceHistoryProps) {
  const { t } = useTranslations();

  return (
    <SummaryTile
      icon={faMicrochip}
      label={t('common.stat.cpu', {})}
      value={summary.cpuAverage === null ? t('common.na', {}) : formatPercent(summary.cpuAverage)}
      caption={summary.cpuAverage === null ? null : t('pages.server.console.history.series.average', {})}
      rows={
        summary.cpuMax === null
          ? null
          : [
              {
                key: 'peak',
                label: t('pages.server.console.history.series.peak', {}),
                value: formatPercent(summary.cpuMax),
              },
            ]
      }
      loading={loading && summary.cpuAverage === null}
    />
  );
}

export function HistoryMemoryCard({ summary, loading }: ResourceHistoryProps) {
  const { t } = useTranslations();

  return (
    <SummaryTile
      icon={faMemory}
      label={t('common.stat.memoryUsage', {})}
      value={summary.memoryAverage === null ? t('common.na', {}) : formatBytes(summary.memoryAverage)}
      caption={summary.memoryAverage === null ? null : t('pages.server.console.history.series.average', {})}
      rows={
        summary.memoryMax === null
          ? null
          : [
              {
                key: 'peak',
                label: t('pages.server.console.history.series.peak', {}),
                value: formatBytes(summary.memoryMax),
              },
            ]
      }
      loading={loading && summary.memoryAverage === null}
    />
  );
}

export function HistoryNetworkCard({ summary, loading }: ResourceHistoryProps) {
  const { t } = useTranslations();
  const empty = summary.networkRxBytes === null || summary.networkTxBytes === null;

  return (
    <SummaryTile
      icon={faCloudDownload}
      label={t('pages.server.console.history.summary.networkTraffic', {})}
      value={
        empty
          ? t('common.na', {})
          : bytesToString((summary.networkRxBytes ?? 0) + (summary.networkTxBytes ?? 0), 1, true)
      }
      caption={empty ? null : t('pages.server.console.history.summary.total', {})}
      rows={
        empty
          ? null
          : [
              {
                key: 'received',
                label: (
                  <>
                    <FontAwesomeIcon icon={faArrowDown} size='xs' />
                    {t('pages.server.console.history.summary.received', {})}
                  </>
                ),
                value: bytesToString(summary.networkRxBytes ?? 0, 1, true),
              },
              {
                key: 'sent',
                label: (
                  <>
                    <FontAwesomeIcon icon={faArrowUp} size='xs' />
                    {t('pages.server.console.history.summary.sent', {})}
                  </>
                ),
                value: bytesToString(summary.networkTxBytes ?? 0, 1, true),
              },
            ]
      }
      loading={loading && summary.networkRxBytes === null}
    />
  );
}

export function HistoryDiskCard({ summary, loading }: ResourceHistoryProps) {
  const { t } = useTranslations();

  return (
    <SummaryTile
      icon={faHardDrive}
      label={t('common.stat.diskUsage', {})}
      value={summary.disk === null ? t('common.na', {}) : formatBytes(summary.disk)}
      caption={summary.disk === null ? null : t('pages.server.console.history.summary.latest', {})}
      rows={
        summary.diskReadBytes === null || summary.diskWriteBytes === null
          ? null
          : [
              {
                key: 'read',
                label: t('pages.server.console.history.summary.read', {}),
                value: bytesToString(summary.diskReadBytes, 1, true),
              },
              {
                key: 'written',
                label: t('pages.server.console.history.summary.written', {}),
                value: bytesToString(summary.diskWriteBytes, 1, true),
              },
            ]
      }
      loading={loading && summary.disk === null}
    />
  );
}
