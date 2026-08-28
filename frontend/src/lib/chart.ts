import { useCallback, useEffect, useMemo, useState } from 'react';
import { bytesToString } from '@/lib/size.ts';

export const CHART_WINDOW = 20_000;
export const CHART_DELAY = 2_000;
export const CHART_TICK = 1_000;

const CHART_TICKS = 3;
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

function niceCeil(value: number, scale: ChartScale): number {
  if (!Number.isFinite(value) || value <= 0) {
    return scale === 'binary' ? 1024 : 1;
  }

  if (scale === 'binary') {
    return 2 ** Math.ceil(Math.log2(value));
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 4, 5, 10].find((step) => magnitude * step >= value) ?? 10) * magnitude;
}

function seriesColor(index: number): string {
  return `var(--chart-series-${(index % CHART_SERIES_COLORS) + 1})`;
}

function seriesDash(index: number, total: number): string | undefined {
  return total > 1 ? CHART_SERIES_DASHES[index % CHART_SERIES_DASHES.length] : undefined;
}

export function useStreamChart({ series: labels, format, scale = 'decimal', min = 0 }: UseStreamChartOptions) {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [end, setEnd] = useState(() => Date.now() - CHART_DELAY);
  const [hidden, setHidden] = useState(NO_HIDDEN_SERIES);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [ceiling, setCeiling] = useState(0);
  const [previousHidden, setPreviousHidden] = useState<ReadonlySet<string>>(NO_HIDDEN_SERIES);

  useEffect(() => {
    const interval = setInterval(() => setEnd(Date.now() - CHART_DELAY), CHART_TICK);

    return () => clearInterval(interval);
  }, []);

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
    setEnd(Date.now() - CHART_DELAY);
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

  const start = end - CHART_WINDOW;
  const visible = samples.filter((sample) => sample.t >= start - 2 * CHART_TICK);

  let peak = min;
  for (const sample of visible) {
    for (let i = 0; i < sample.values.length; i++) {
      const value = sample.values[i];
      if (value !== null && value > peak && !hidden.has(`v${i}`)) {
        peak = value;
      }
    }
  }

  const wanted = niceCeil(peak * 1.25, scale);

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
  const values = samples.at(-1)?.values ?? [];

  const series = useMemo<StreamChartSeries[]>(
    () =>
      labels.map((label, index) => {
        const value = values[index] ?? null;
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
    [labels, values, format, hidden],
  );

  return {
    props: {
      data,
      domain: [end - CHART_WINDOW, end] as [number, number],
      ticks,
      yMax: nextCeiling,
      series,
      format,
      highlighted,
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
