import { faCloudDownload, faMemory, faMicrochip, faPowerOff } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useMemo, useRef } from 'react';
import ChartBlock from '@/elements/charts/ChartBlock.tsx';
import ChartLegend from '@/elements/charts/ChartLegend.tsx';
import StreamChart from '@/elements/charts/StreamChart.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import { formatBytes, formatBytesRate, formatPercent, useStreamChart } from '@/lib/chart.ts';
import { mbToBytes } from '@/lib/format/size.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function ServerStats() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const stats = useServerStore((state) => state.stats);

  const networkPrevious = useRef<{
    tx: number;
    rx: number;
    uptime: number;
    timestamp: number;
  } | null>(null);
  const wasOffline = useRef(false);

  const cpu = useStreamChart({
    series: useMemo(() => [t('common.stat.cpuLoad', {})], [t]),
    format: formatPercent,
    min: 10,
  });
  const memory = useStreamChart({
    series: useMemo(() => [t('common.stat.memoryLoad', {})], [t]),
    format: formatBytes,
    scale: 'binary',
    min: mbToBytes(64),
  });
  const network = useStreamChart({
    series: useMemo(() => [t('common.stat.outbound', {}), t('common.stat.inbound', {})], [t]),
    format: formatBytesRate,
    scale: 'binary',
  });

  const offline = !stats?.state || (stats.state === 'offline' && server.status !== 'installing');

  useEffect(() => {
    if (offline) {
      networkPrevious.current = null;
      if (!wasOffline.current) {
        wasOffline.current = true;
        cpu.push(0);
        memory.push(0);
        network.push([0, 0]);
      }
      return;
    }

    wasOffline.current = false;
    cpu.push(stats.cpuAbsolute);
    memory.push(stats.memoryBytes);
    const now = performance.now();
    const previous = networkPrevious.current;
    const elapsedSeconds = previous ? (now - previous.timestamp) / 1000 : 0;
    const canCalculateRate =
      previous &&
      elapsedSeconds > 0 &&
      stats.uptime >= previous.uptime &&
      stats.network.txBytes >= previous.tx &&
      stats.network.rxBytes >= previous.rx;

    network.push(
      canCalculateRate
        ? [
            (stats.network.txBytes - previous.tx) / elapsedSeconds,
            (stats.network.rxBytes - previous.rx) / elapsedSeconds,
          ]
        : [0, 0],
    );

    networkPrevious.current = {
      tx: stats.network.txBytes,
      rx: stats.network.rxBytes,
      uptime: stats.uptime,
      timestamp: now,
    };
  }, [stats, offline, cpu.push, memory.push, network.push]);

  const overlayIcon = <FontAwesomeIcon icon={faPowerOff} className='text-2xl' />;
  const overlayLabel = offline ? t('pages.server.console.stats.offline', {}) : undefined;

  return (
    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
      <ChartBlock
        icon={<FontAwesomeIcon icon={faMicrochip} />}
        title={t('common.stat.cpuLoad', {})}
        value={cpu.value}
        overlayIcon={overlayIcon}
        overlayLabel={overlayLabel}
      >
        <StreamChart {...cpu.props} />
      </ChartBlock>
      <ChartBlock
        icon={<FontAwesomeIcon icon={faMemory} />}
        title={t('common.stat.memoryLoad', {})}
        value={memory.value}
        overlayIcon={overlayIcon}
        overlayLabel={overlayLabel}
      >
        <StreamChart {...memory.props} />
      </ChartBlock>
      <ChartBlock
        icon={<FontAwesomeIcon icon={faCloudDownload} />}
        title={t('common.stat.network', {})}
        legend={<ChartLegend {...network.legend} />}
        overlayIcon={overlayIcon}
        overlayLabel={overlayLabel}
      >
        <StreamChart {...network.props} />
      </ChartBlock>
      <ExtensionSlot
        components={window.extensionContext.extensionRegistry.pages.server.console.statBlocks}
        name='console-stat-block'
      />
    </div>
  );
}
