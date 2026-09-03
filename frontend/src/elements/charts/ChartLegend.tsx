import { makeComponentHookable } from 'shared';
import { ChartLegendProps, StreamChartSeries } from '@/lib/chart.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

function SeriesKey({ entry }: { entry: StreamChartSeries }) {
  return (
    <svg width={14} height={2} viewBox='0 0 14 2' className='-mt-0.5 shrink-0 overflow-visible' aria-hidden>
      <line
        x1={1}
        y1={1}
        x2={13}
        y2={1}
        stroke={entry.color}
        strokeWidth={2}
        strokeLinecap='round'
        strokeDasharray={entry.dash}
      />
    </svg>
  );
}

function ChartLegend({ series, onToggle, onHighlight }: ChartLegendProps) {
  const { t } = useTranslations();

  return (
    <>
      {series.map((entry) =>
        onToggle ? (
          <button
            key={entry.key}
            type='button'
            aria-pressed={!entry.hidden}
            aria-label={t(entry.hidden ? 'elements.chartLegend.show' : 'elements.chartLegend.hide', {
              series: entry.label,
            })}
            onClick={() => onToggle(entry.key)}
            onMouseEnter={() => onHighlight?.(entry.key)}
            onMouseLeave={() => onHighlight?.(null)}
            onFocus={() => onHighlight?.(entry.key)}
            onBlur={() => onHighlight?.(null)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-sm text-xs whitespace-nowrap transition-opacity hover:opacity-80 ${entry.hidden ? 'opacity-50' : ''}`}
          >
            <SeriesKey entry={entry} />
            <span className={entry.hidden ? 'line-through' : undefined}>{entry.label}</span>
            {entry.formatted !== null && (
              <span className={`tabular-nums text-(--mantine-color-dimmed) ${entry.hidden ? 'line-through' : ''}`}>
                {entry.formatted}
              </span>
            )}
          </button>
        ) : (
          <span key={entry.key} className='flex items-center gap-1.5 text-xs whitespace-nowrap'>
            <SeriesKey entry={entry} />
            {entry.label}
            {entry.formatted !== null && (
              <span className='tabular-nums text-(--mantine-color-dimmed)'>{entry.formatted}</span>
            )}
          </span>
        ),
      )}
    </>
  );
}

export default makeComponentHookable(ChartLegend);
