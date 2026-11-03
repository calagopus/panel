import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { bytesToString } from '@/lib/format/size.ts';

export const CHART_WINDOW = 20_000;
export const CHART_DELAY = 2_000;
export const CHART_TICK = 1_000;

const CHART_TICKS = 3;
const CHART_HEADROOM = 1.25;
const CHART_LIMIT_REACH = 0.4;
const CHART_SERIES_COLORS = 4;
const CHART_SERIES_DASHES = [undefined, '6 4', '2 3', '10 4 2 4'];

const NO_HIDDEN_SERIES: ReadonlySet<string> = new Set();

export type ChartScale = 'decimal' | 'binary';

interface Sample {
  t: number;
  values: (number | null)[];
}

export interface StreamChartSeries {
  key: string;
  label: string;
  color: string;
  value: number | null;
  formatted: string | null;
  dash?: string;
  hidden?: boolean;
}

export interface StreamChartProps {
  data: Record<string, number | null>[];
  domain: [number, number];
  ticks: number[];
  yMax: number;
  series: StreamChartSeries[];
  format: (value: number) => string;
  highlighted?: string | null;
  limit?: number | null;
  compact?: boolean;
}

export interface ChartLegendProps {
  series: StreamChartSeries[];
  onToggle?: (key: string) => void;
  onHighlight?: (key: string | null) => void;
}

export interface UseStreamChartOptions {
  series: string[];
  format: (value: number) => string;
  scale?: ChartScale;
  min?: number;
  limit?: number | null;
}

export function formatPercent(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}

export function formatBytes(value: number): string {
  return bytesToString(value, 2, true);
}

export function formatBytesRate(value: number): string {
  return `${bytesToString(value, 2, true)}/s`;
}

export function niceCeil(value: number, scale: ChartScale): number {
  if (!Number.isFinite(value) || value <= 0) {
    return scale === 'binary' ? 1024 : 1;
  }

  if (scale === 'binary') {
    return 2 ** Math.ceil(Math.log2(value));
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 4, 5, 10].find((step) => magnitude * step >= value) ?? 10) * magnitude;
}

const clockListeners = new Set<() => void>();
let clockEnd = Date.now() - CHART_DELAY;
let clockInterval: ReturnType<typeof setInterval> | null = null;

function refreshStaleClock() {
  const end = Date.now() - CHART_DELAY;
  if (end - clockEnd >= CHART_TICK) {
    clockEnd = end;
  }
}

function tickClock() {
  clockEnd = Date.now() - CHART_DELAY;
  for (const listener of clockListeners) {
    listener();
  }
}

function startClock() {
  if (clockInterval === null && !document.hidden) {
    clockInterval = setInterval(tickClock, CHART_TICK);
  }
}

function stopClock() {
  if (clockInterval !== null) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
}

function onClockVisibilityChange() {
  if (document.hidden) {
    stopClock();
    return;
  }

  tickClock();
  startClock();
}

function subscribeClock(listener: () => void) {
  if (clockListeners.size === 0) {
    refreshStaleClock();
    document.addEventListener('visibilitychange', onClockVisibilityChange);
    startClock();
  }
  clockListeners.add(listener);

  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0) {
      document.removeEventListener('visibilitychange', onClockVisibilityChange);
      stopClock();
    }
  };
}

function getClockEnd() {
  if (clockListeners.size === 0) {
    refreshStaleClock();
  }

  return clockEnd;
}

function useChartClock(): number {
  return useSyncExternalStore(subscribeClock, getClockEnd);
}

export function seriesColor(index: number): string {
  return `var(--chart-series-${(index % CHART_SERIES_COLORS) + 1})`;
}

export function seriesDash(index: number, total: number): string | undefined {
  return total > 1 ? CHART_SERIES_DASHES[index % CHART_SERIES_DASHES.length] : undefined;
}

export function useStreamChart({
  series: labels,
  format,
  scale = 'decimal',
  min = 0,
  limit = null,
}: UseStreamChartOptions) {
  const end = useChartClock();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [drawn, setDrawn] = useState({ end, samples });
  const [hidden, setHidden] = useState(NO_HIDDEN_SERIES);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [ceiling, setCeiling] = useState(0);
  const [previousHidden, setPreviousHidden] = useState<ReadonlySet<string>>(NO_HIDDEN_SERIES);

  if (drawn.end !== end) {
    setDrawn({ end, samples });
  }

  const push = useCallback((values: number | null | (number | null)[]) => {
    const now = Date.now();
    const oldest = now - (CHART_WINDOW + CHART_DELAY + 4 * CHART_TICK);

    setSamples((current) => {
      const next = [...current, { t: now, values: Array.isArray(values) ? values : [values] }];

      return next.filter((sample) => sample.t >= oldest);
    });
  }, []);

  const clear = useCallback(() => {
    setSamples([]);
    setCeiling(0);
    setDrawn({ end: getClockEnd(), samples: [] });
  }, []);

  const toggleSeries = useCallback(
    (key: string) =>
      setHidden((current) => {
        if (!current.has(key)) {
          if (current.size >= labels.length - 1) {
            return current;
          }

          return new Set(current).add(key);
        }

        const next = new Set(current);
        next.delete(key);

        return next;
      }),
    [labels.length],
  );

  const start = drawn.end - CHART_WINDOW;
  const visible = drawn.samples.filter((sample) => sample.t >= start - 2 * CHART_TICK);

  let peak = min;
  for (const sample of visible) {
    for (let i = 0; i < sample.values.length; i++) {
      const value = sample.values[i];
      if (value !== null && value > peak && !hidden.has(`v${i}`)) {
        peak = value;
      }
    }
  }

  const wanted =
    limit !== null && limit > 0 && peak >= limit * CHART_LIMIT_REACH && peak <= limit
      ? limit
      : niceCeil(peak * CHART_HEADROOM, scale);

  if (previousHidden !== hidden) {
    setPreviousHidden(hidden);
    setCeiling(wanted);
  } else if (wanted > ceiling || wanted <= ceiling / 2) {
    setCeiling(wanted);
  }

  const nextCeiling = previousHidden !== hidden ? wanted : wanted > ceiling || wanted <= ceiling / 2 ? wanted : ceiling;

  const data = visible.map((sample) => {
    const row: Record<string, number | null> = { t: sample.t };
    for (let i = 0; i < labels.length; i++) {
      row[`v${i}`] = sample.values[i] ?? null;
    }
    return row;
  });
  const ticks = Array.from({ length: CHART_TICKS }, (_, i) => (nextCeiling * i) / (CHART_TICKS - 1));
  const latest = samples.at(-1);

  const series = useMemo<StreamChartSeries[]>(
    () =>
      labels.map((label, index) => {
        const value = latest?.values[index] ?? null;
        const key = `v${index}`;

        return {
          key,
          label,
          color: seriesColor(index),
          value,
          formatted: value === null ? null : format(value),
          dash: seriesDash(index, labels.length),
          hidden: hidden.has(key),
        };
      }),
    [labels, latest, format, hidden],
  );

  return {
    props: {
      data,
      domain: [start, drawn.end] as [number, number],
      ticks,
      yMax: nextCeiling,
      series,
      format,
      highlighted,
      limit,
    } satisfies StreamChartProps,
    legend: {
      series,
      onToggle: toggleSeries,
      onHighlight: setHighlighted,
    } satisfies ChartLegendProps,
    series,
    value: series.length === 1 ? series[0].formatted : null,
    push,
    clear,
  };
}

export interface HistoryChartSeries {
  key: string;
  label: string;
  color?: string;
  dash?: string;
  /** Draws the area under the line, defaults to `true`. */
  fill?: boolean;
  /**
   * Marks the series as a limit: drawn as a red stepped line that only lifts the y axis while the
   * other series come within reach of it, the same way the live charts treat their limit.
   */
  limit?: boolean;
}

export interface HistoryChartProps {
  data: Record<string, unknown>[];
  domain: [number, number];
  series: HistoryChartSeries[];
  format: (value: number) => string;
  scale?: ChartScale;
  min?: number;
  height?: number;
  syncId?: string;
}

export function historyChartSeriesColor(entry: HistoryChartSeries, index: number): string {
  return entry.color ?? (entry.limit ? 'var(--mantine-color-red-filled)' : seriesColor(index));
}

export function historyChartLegend(series: HistoryChartSeries[]): ChartLegendProps {
  const plotted = series.filter((entry) => !entry.limit);

  return {
    series: series.map((entry) => ({
      key: entry.key,
      label: entry.label,
      color: historyChartSeriesColor(entry, plotted.indexOf(entry)),
      value: null,
      formatted: null,
      dash: entry.dash ?? (entry.limit ? '4 3' : undefined),
    })),
  };
}

export function historyChartCeiling(
  data: Record<string, unknown>[],
  series: HistoryChartSeries[],
  scale: ChartScale,
  min: number,
): { ceiling: number; limit: number | null } {
  let peak = min;
  let limit = 0;

  for (const row of data) {
    for (const entry of series) {
      const value = row[entry.key];
      if (typeof value !== 'number') continue;

      if (entry.limit) {
        limit = Math.max(limit, value);
      } else {
        peak = Math.max(peak, value);
      }
    }
  }

  return {
    ceiling:
      limit > 0 && peak >= limit * CHART_LIMIT_REACH && peak <= limit ? limit : niceCeil(peak * CHART_HEADROOM, scale),
    limit: limit > 0 ? limit : null,
  };
}
