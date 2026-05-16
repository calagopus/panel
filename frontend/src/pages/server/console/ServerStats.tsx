import {
  faCloudArrowDown,
  faCloudArrowUp,
  faCloudDownload,
  faMemory,
  faMicrochip,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import ChartBlock from '@/elements/ChartBlock.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { useChart, useChartTickLabel } from '@/lib/chart.ts';
import { hexToRgba } from '@/lib/color.ts';
import { bytesToString } from '@/lib/size.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function ServerStats() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const stats = useServerStore((state) => state.stats);

  const networkPrevious = useRef<Record<'tx' | 'rx', number>>({ tx: -1, rx: -1 });

  const cpu = useChartTickLabel(t('pages.server.console.stats.cpuLoad', {}), server.limits.cpu, '%', 2);
  const memory = useChartTickLabel(t('pages.server.console.stats.memoryLoad', {}), server.limits.memory, 'MiB');
  const network = useChart(t('pages.server.console.stats.network', {}), {
    sets: 2,
    options: {
      scales: {
        y: {
          ticks: {
            callback(value) {
              return bytesToString(typeof value === 'string' ? parseInt(value, 10) : value);
            },
          },
        },
      },
    },
    callback(opts, index) {
      return {
        ...opts,
        label: !index ? t('pages.server.console.stats.inbound', {}) : t('pages.server.console.stats.outbound', {}),
        borderColor: !index ? '#22d3ee' : '#facc15', // cyan-400 & yellow-400
        backgroundColor: hexToRgba(!index ? '#0e7490' : '#a16207', 0.5), // cyan-700 & yellow-700
      };
    },
  });

  useEffect(() => {
    if (!stats?.state || (stats?.state === 'offline' && server.status !== 'installing')) {
      return;
    }

    cpu.push(stats.cpuAbsolute);
    memory.push(Math.floor(stats.memoryBytes / 1024 / 1024));
    network.push([
      networkPrevious.current.tx < 0 ? 0 : Math.max(0, stats.network.txBytes - networkPrevious.current.tx),
      networkPrevious.current.rx < 0 ? 0 : Math.max(0, stats.network.rxBytes - networkPrevious.current.rx),
    ]);

    networkPrevious.current = { tx: stats.network.txBytes, rx: stats.network.rxBytes };
  }, [stats]);

  return (
    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
      <ChartBlock icon={<FontAwesomeIcon icon={faMicrochip} />} title={t('pages.server.console.stats.cpuLoad', {})}>
        <Line {...cpu.props} />
      </ChartBlock>
      <ChartBlock icon={<FontAwesomeIcon icon={faMemory} />} title={t('pages.server.console.stats.memoryLoad', {})}>
        <Line {...memory.props} />
      </ChartBlock>
      <ChartBlock
        icon={<FontAwesomeIcon icon={faCloudDownload} />}
        title={t('pages.server.console.stats.network', {})}
        legend={
          <>
            <Tooltip label={t('pages.server.console.stats.inbound', {})}>
              <FontAwesomeIcon icon={faCloudArrowDown} className='mr-2 h-4 w-4 text-yellow-400' />
            </Tooltip>
            <Tooltip label={t('pages.server.console.stats.outbound', {})}>
              <FontAwesomeIcon icon={faCloudArrowUp} className='h-4 w-4 text-cyan-400' />
            </Tooltip>
          </>
        }
      >
        <Line {...network.props} />
      </ChartBlock>
      {window.extensionContext.extensionRegistry.pages.server.console.statBlocks.map((StatBlock, i) => (
        <StatBlock key={`console-stat-block-${i}`} />
      ))}
    </div>
  );
}
