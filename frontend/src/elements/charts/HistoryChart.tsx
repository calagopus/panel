import { faArrowUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { AreaChart } from '@mantine/charts';
import { PointerEvent, useEffect, useMemo, useState } from 'react';
import { DefaultZIndexes, usePlotArea, ZIndexLayer } from 'recharts';
import { makeComponentHookable } from 'shared';
import { HistoryChartProps, historyChartCeiling, historyChartSeriesColor } from '@/lib/chart.ts';
import { formatDateTime } from '@/lib/format/time.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

import '@mantine/charts/styles.css';

const X_TICKS = 5;
const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
const MIN_SELECTION_PX = 5;

function HistoryChartSelection({
  domain: [start, end],
  onSelect,
}: {
  domain: [number, number];
  onSelect: (start: number, end: number) => void;
}) {
  const plot = usePlotArea();
  const [selection, setSelection] = useState<{ from: number; to: number } | null>(null);
  const selecting = selection !== null;

  useEffect(() => {
    if (!selecting) return;

    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelection(null);
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [selecting]);

  if (!plot || end <= start) return null;

  const toTime = (event: PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0;
    return start + Math.min(Math.max(ratio, 0), 1) * (end - start);
  };
  const toX = (time: number) => plot.x + ((Math.min(Math.max(time, start), end) - start) / (end - start)) * plot.width;
  const from = selection ? Math.min(selection.from, selection.to) : 0;
  const to = selection ? Math.max(selection.from, selection.to) : 0;

  return (
    <>
      {selection && (
        <ZIndexLayer zIndex={DefaultZIndexes.area + 1}>
          <rect
            x={toX(from)}
            y={plot.y}
            width={toX(to) - toX(from)}
            height={plot.height}
            fill='var(--mantine-primary-color-filled)'
            fillOpacity={0.15}
            pointerEvents='none'
          />
        </ZIndexLayer>
      )}
      <ZIndexLayer zIndex={DefaultZIndexes.label + 1}>
        <rect
          x={plot.x}
          y={plot.y}
          width={plot.width}
          height={plot.height}
          fill='transparent'
          onPointerDown={(event) => {
            if (event.pointerType === 'touch' || event.button !== 0) return;

            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            const time = toTime(event);
            setSelection({ from: time, to: time });
          }}
          onPointerMove={(event) => {
            if (!selection) return;

            const time = toTime(event);
            setSelection((current) => (current ? { ...current, to: time } : current));
          }}
          onPointerUp={(event) => {
            if (!selection) return;

            const bounds = event.currentTarget.getBoundingClientRect();
            const width = (Math.abs(toTime(event) - selection.from) / (end - start)) * bounds.width;
            const [a, b] = [selection.from, toTime(event)].sort((x, y) => x - y);
            setSelection(null);
            if (width >= MIN_SELECTION_PX) onSelect(Math.round(a), Math.round(b));
          }}
          onLostPointerCapture={() => setSelection(null)}
        />
      </ZIndexLayer>
    </>
  );
}

function HistoryChart({
  data,
  domain,
  series,
  format,
  scale = 'decimal',
  min = 0,
  height = 210,
  syncId,
  onSelectRange,
}: HistoryChartProps) {
  const { t, language } = useTranslations();
  const [start, end] = domain;

  const lines = useMemo(() => {
    const plotted = series.filter((entry) => !entry.limit);

    return series.map((entry) => ({
      name: entry.key,
      label: entry.label,
      color: historyChartSeriesColor(entry, plotted.indexOf(entry)),
      strokeDasharray: entry.dash ?? (entry.limit ? '4 3' : undefined),
      curveType: entry.limit ? ('stepAfter' as const) : ('monotone' as const),
    }));
  }, [series]);

  const filled = useMemo(
    () => new Set(series.filter((entry) => !entry.limit && entry.fill !== false).map((entry) => entry.key)),
    [series],
  );

  const { ceiling, limit } = historyChartCeiling(data, series, scale, min);
  const isolated = (key: string, index: number) =>
    typeof data[index]?.[key] === 'number' &&
    typeof data[index - 1]?.[key] !== 'number' &&
    typeof data[index + 1]?.[key] !== 'number';
  const sparse = new Set(
    series.filter((entry) => data.some((_, index) => isolated(entry.key, index))).map((entry) => entry.key),
  );
  const ticks = Array.from({ length: X_TICKS }, (_, i) => start + ((end - start) * i) / (X_TICKS - 1));
  const formatTick = (value: number) =>
    new Date(value).toLocaleString(
      language,
      end - start <= TWO_DAYS ? { hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric' },
    );

  return (
    <div className='relative touch-pan-y'>
      {limit !== null && limit > ceiling && (
        <span className='pointer-events-none absolute top-0 right-1 z-10 whitespace-nowrap text-[10px] text-(--mantine-color-dimmed) tabular-nums'>
          <FontAwesomeIcon icon={faArrowUp} className='mr-1' />
          {t('common.stat.limit', { limit: format(limit) })}
        </span>
      )}
      <AreaChart
        h={height}
        data={data}
        dataKey='t'
        series={lines}
        withGradient
        fillOpacity={0.25}
        strokeWidth={2}
        withDots={false}
        gridAxis='x'
        connectNulls={false}
        valueFormatter={format}
        xAxisProps={{
          type: 'number',
          scale: 'time',
          domain: [start, end],
          ticks,
          tickFormatter: formatTick,
          allowDataOverflow: true,
        }}
        yAxisProps={{ domain: [0, ceiling], ticks: [0, ceiling / 2, ceiling], allowDataOverflow: true, width: 72 }}
        tooltipProps={{ labelFormatter: (label) => (typeof label === 'number' ? formatDateTime(label) : label) }}
        areaProps={(entry) => ({
          isAnimationActive: false,
          fillOpacity: filled.has(entry.name) ? 1 : 0,
          dot: sparse.has(entry.name)
            ? ({ cx, cy, index }: { cx?: number; cy?: number; index: number }) =>
                cx !== undefined && cy !== undefined && isolated(entry.name, index) ? (
                  <circle key={index} cx={cx} cy={cy} r={2.5} fill={entry.color} />
                ) : (
                  <g key={index} />
                )
            : false,
        })}
        areaChartProps={{ syncId, style: { cursor: 'crosshair' } }}
      >
        {onSelectRange && <HistoryChartSelection domain={domain} onSelect={onSelectRange} />}
      </AreaChart>
    </div>
  );
}

export default makeComponentHookable(HistoryChart);
