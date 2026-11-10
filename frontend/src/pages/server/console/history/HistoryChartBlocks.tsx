import type { ResourceHistoryProps } from 'shared/src/registries/pages/server/console/history.ts';
import { faCloudDownload, faHardDrive, faMemory, faMicrochip } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ReactNode } from 'react';
import ChartBlock from '@/elements/charts/ChartBlock.tsx';
import ChartLegend from '@/elements/charts/ChartLegend.tsx';
import HistoryChart from '@/elements/charts/HistoryChart.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { ChartScale, formatBytes, formatPercent, HistoryChartSeries, historyChartLegend } from '@/lib/chart.ts';
import { bitsPerSecondToString, mbToBytes } from '@/lib/format/size.ts';
import { RESOURCE_HISTORY_CHART_SYNC_ID } from '@/lib/resourceHistory.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

function HistoryBlock({
  icon,
  title,
  series,
  format,
  scale,
  min,
  props: { timeframe, rows, loading },
}: {
  icon: ReactNode;
  title: string;
  series: HistoryChartSeries[];
  format: (value: number) => string;
  scale?: ChartScale;
  min?: number;
  props: ResourceHistoryProps;
}) {
  const { t } = useTranslations();
  const empty = !rows.some((row) =>
    series.some((entry) => !entry.limit && typeof (row as Record<string, unknown>)[entry.key] === 'number'),
  );

  return (
    <ChartBlock
      icon={icon}
      title={title}
      legend={<ChartLegend {...historyChartLegend(series)} />}
      overlayIcon={loading ? <Spinner size={24} /> : undefined}
      overlayLabel={
        empty
          ? t(loading ? 'pages.server.console.history.loading' : 'pages.server.console.history.noData', {})
          : undefined
      }
    >
      <HistoryChart
        data={rows}
        domain={[timeframe.start.getTime(), timeframe.end.getTime()]}
        series={series}
        format={format}
        scale={scale}
        min={min}
        syncId={RESOURCE_HISTORY_CHART_SYNC_ID}
      />
    </ChartBlock>
  );
}

export function HistoryCpuBlock(props: ResourceHistoryProps) {
  const { t } = useTranslations();

  return (
    <HistoryBlock
      icon={<FontAwesomeIcon icon={faMicrochip} />}
      title={t('common.stat.cpuLoad', {})}
      series={[
        { key: 'cpuAverage', label: t('pages.server.console.history.series.average', {}) },
        { key: 'cpuMax', label: t('pages.server.console.history.series.peak', {}), dash: '6 4', fill: false },
        { key: 'cpuLimit', label: t('pages.server.console.history.series.limit', {}), limit: true },
      ]}
      format={formatPercent}
      min={10}
      props={props}
    />
  );
}

export function HistoryMemoryBlock(props: ResourceHistoryProps) {
  const { t } = useTranslations();

  return (
    <HistoryBlock
      icon={<FontAwesomeIcon icon={faMemory} />}
      title={t('common.stat.memoryLoad', {})}
      series={[
        { key: 'memoryAverage', label: t('pages.server.console.history.series.average', {}) },
        { key: 'memoryMax', label: t('pages.server.console.history.series.peak', {}), dash: '6 4', fill: false },
        { key: 'memoryLimit', label: t('pages.server.console.history.series.limit', {}), limit: true },
      ]}
      format={formatBytes}
      scale='binary'
      min={mbToBytes(64)}
      props={props}
    />
  );
}

export function HistoryNetworkBlock(props: ResourceHistoryProps) {
  const { t } = useTranslations();

  return (
    <HistoryBlock
      icon={<FontAwesomeIcon icon={faCloudDownload} />}
      title={t('common.stat.network', {})}
      series={[
        { key: 'networkTx', label: t('common.stat.outbound', {}) },
        { key: 'networkRx', label: t('common.stat.inbound', {}), dash: '6 4' },
      ]}
      format={bitsPerSecondToString}
      min={1000}
      props={props}
    />
  );
}

export function HistoryDiskBlock(props: ResourceHistoryProps) {
  const { t } = useTranslations();

  return (
    <HistoryBlock
      icon={<FontAwesomeIcon icon={faHardDrive} />}
      title={t('common.stat.diskUsage', {})}
      series={[
        { key: 'disk', label: t('common.stat.diskUsage', {}) },
        { key: 'diskLimit', label: t('pages.server.console.history.series.limit', {}), limit: true },
      ]}
      format={formatBytes}
      scale='binary'
      min={mbToBytes(64)}
      props={props}
    />
  );
}
