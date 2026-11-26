import {
  faArrowDown,
  faArrowUp,
  faCloudDownload,
  faHardDrive,
  faMemory,
  faMicrochip,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import StreamChart from '@/elements/charts/StreamChart.tsx';
import MetricTile from '@/elements/data-display/MetricTile.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import { formatBytesRate, formatPercent } from '@/lib/chart.ts';
import { bitsPerSecondToString, bytesToString, mbToBytes } from '@/lib/format/size.ts';
import { useUserSetting } from '@/lib/userSettings.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import CpuLoadSettings, { NORMALIZE_CPU_LOAD_KEY, normalizeCpuLoadSchema } from './CpuLoadSettings.tsx';
import HistoryLink from './HistoryLink.tsx';
import { useServerMetrics } from './useServerMetrics.ts';

export default function ServerMetricTiles() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const [doNormalizeCpuLoad] = useUserSetting(NORMALIZE_CPU_LOAD_KEY, normalizeCpuLoadSchema, false);
  const { stats, statsPending, offline, rates, cpu, memory, network, diskIo } = useServerMetrics();

  const offlineLabel = t('common.enum.serverState.offline', {});
  const unlimited = t('common.unlimited', {});
  const cpuLimitAbsolute = stats?.cpuLimitAbsolute || 100;
  const formatCpu = doNormalizeCpuLoad
    ? (value: number) => formatPercent((value / cpuLimitAbsolute) * 100)
    : cpu.props.format;

  return (
    <div className='grid min-w-0 gap-4 sm:grid-cols-2 xl:flex xl:flex-col'>
      <MetricTile
        icon={faMicrochip}
        label={t('common.stat.cpuLoad', {})}
        order={40}
        className='xl:flex-[1_0_auto]'
        loading={statsPending}
        value={
          offline
            ? offlineLabel
            : doNormalizeCpuLoad
              ? `${(((stats?.cpuAbsolute || 0) / cpuLimitAbsolute) * 100).toFixed(2)}%`
              : `${(stats?.cpuAbsolute || 0).toFixed(2)}%`
        }
        limit={doNormalizeCpuLoad ? null : server.limits.cpu !== 0 ? `${server.limits.cpu}%` : unlimited}
        progress={offline ? null : stats?.cpuAbsolute}
        total={server.limits.cpu}
        action={<HistoryLink />}
        popover={<CpuLoadSettings />}
        chart={<StreamChart {...cpu.props} format={formatCpu} compact />}
        chartVisible={!offline}
      />

      <MetricTile
        icon={faMemory}
        label={t('common.stat.memoryLoad', {})}
        order={50}
        className='xl:flex-[1_0_auto]'
        loading={statsPending}
        value={offline ? offlineLabel : bytesToString(stats?.memoryBytes || 0)}
        limit={server.limits.memory !== 0 ? bytesToString(mbToBytes(server.limits.memory)) : unlimited}
        progress={offline ? null : stats?.memoryBytes}
        total={mbToBytes(server.limits.memory)}
        action={<HistoryLink />}
        chart={<StreamChart {...memory.props} compact />}
        chartVisible={!offline}
      />

      <MetricTile
        icon={faHardDrive}
        label={t('common.stat.diskUsage', {})}
        order={60}
        className={stats?.disk || statsPending ? 'xl:flex-[1_0_auto]' : 'xl:shrink-0'}
        loading={statsPending}
        value={bytesToString(stats?.diskBytes || 0)}
        limit={server.limits.disk !== 0 ? bytesToString(mbToBytes(server.limits.disk)) : unlimited}
        progress={stats?.diskBytes}
        total={mbToBytes(server.limits.disk)}
        action={<HistoryLink />}
        rows={
          offline || !stats?.disk
            ? null
            : [
                {
                  series: diskIo.series[0],
                  value: formatBytesRate(rates.diskWrite),
                  details: t('pages.server.console.details.diskDetails', {
                    total: bytesToString(stats.disk.writeBytes),
                    ops: Math.round(rates.diskWriteOps),
                  }),
                },
                {
                  series: diskIo.series[1],
                  value: formatBytesRate(rates.diskRead),
                  details: t('pages.server.console.details.diskDetails', {
                    total: bytesToString(stats.disk.readBytes),
                    ops: Math.round(rates.diskReadOps),
                  }),
                },
              ]
        }
        chart={(stats?.disk || statsPending) && <StreamChart {...diskIo.props} compact />}
        chartVisible={!offline}
      />

      <MetricTile
        icon={faCloudDownload}
        label={t('common.stat.network', {})}
        order={70}
        className='xl:flex-[1_0_auto]'
        loading={statsPending}
        value={offline ? offlineLabel : null}
        action={<HistoryLink />}
        rows={
          offline
            ? null
            : [
                {
                  series: network.series[0],
                  label: <FontAwesomeIcon icon={faArrowUp} size='xs' aria-label={t('common.stat.outbound', {})} />,
                  value: bitsPerSecondToString(rates.networkTx),
                  limit:
                    server.limits.bandwidth.upload !== 0 ? bitsPerSecondToString(server.limits.bandwidth.upload) : null,
                  details: t('pages.server.console.details.networkDetails', {
                    total: bytesToString(stats?.network.txBytes || 0),
                    packets: Math.round(rates.networkTxPackets),
                  }),
                  progress: rates.networkTx,
                  total: server.limits.bandwidth.upload,
                },
                {
                  series: network.series[1],
                  label: <FontAwesomeIcon icon={faArrowDown} size='xs' aria-label={t('common.stat.inbound', {})} />,
                  value: bitsPerSecondToString(rates.networkRx),
                  limit:
                    server.limits.bandwidth.download !== 0
                      ? bitsPerSecondToString(server.limits.bandwidth.download)
                      : null,
                  details: t('pages.server.console.details.networkDetails', {
                    total: bytesToString(stats?.network.rxBytes || 0),
                    packets: Math.round(rates.networkRxPackets),
                  }),
                  progress: rates.networkRx,
                  total: server.limits.bandwidth.download,
                },
              ]
        }
        chart={<StreamChart {...network.props} compact />}
        chartVisible={!offline}
      />

      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.pages.server.console.statCards}
        name='console-stat-card'
      />
    </div>
  );
}
