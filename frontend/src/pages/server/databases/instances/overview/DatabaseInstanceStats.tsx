import { faMemory, faMicrochip, faPowerOff } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useMemo, useRef } from 'react';
import ChartBlock from '@/elements/charts/ChartBlock.tsx';
import ChartSyncGroup from '@/elements/charts/ChartSyncGroup.tsx';
import StreamChart from '@/elements/charts/StreamChart.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { formatBytes, formatPercent, useStreamChart } from '@/lib/chart.ts';
import { mbToBytes } from '@/lib/format/size.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function DatabaseInstanceStats() {
  const { t } = useTranslations();
  const usage = useServerStore((state) => state.databaseInstanceUsage);

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

  const offline = !usage || usage.state === 'offline';

  useEffect(() => {
    if (offline) {
      if (!wasOffline.current) {
        wasOffline.current = true;
        cpu.push(0);
        memory.push(0);
      }
      return;
    }

    wasOffline.current = false;
    cpu.push(usage.cpuAbsolute);
    memory.push(usage.memoryBytes);
  }, [usage]);

  const statsPending = !usage;

  const overlayIcon = statsPending ? <Spinner size={24} /> : <FontAwesomeIcon icon={faPowerOff} className='text-2xl' />;
  const overlayLabel = statsPending
    ? t('pages.server.databases.instance.view.stats.connecting', {})
    : offline
      ? t('pages.server.databases.instance.view.stats.offline', {})
      : undefined;

  return (
    <ChartSyncGroup>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0'>
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
      </div>
    </ChartSyncGroup>
  );
}
