import StreamingPlugin from '@robloche/chartjs-plugin-streaming';
import {
  ChartData,
  ChartDataset,
  Chart as ChartJS,
  ChartOptions,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
} from 'chart.js';
import 'chartjs-adapter-moment';
import { useComputedColorScheme } from '@mantine/core';
import { deepmerge, deepmergeCustom } from 'deepmerge-ts';
import { useEffect, useMemo, useRef, useState } from 'react';

ChartJS.register(LineElement, PointElement, Filler, LinearScale, StreamingPlugin);

const defaultOptions: ChartOptions<'line'> = {
  responsive: true,
  plugins: {
    legend: { display: false },
    title: { display: false },
    tooltip: { enabled: true },
  },
  scales: {
    x: {
      type: 'realtime',
      realtime: {
        duration: 20000,
        delay: 2000,
      },
      ticks: {
        display: false,
      },
      grid: { display: false },
    },
    y: {
      type: 'linear',
      min: 0,
      ticks: { count: 3, font: { size: 11, weight: 'lighter' } },
    },
  },
  elements: {
    point: { radius: 0 },
    line: { tension: 0.4, cubicInterpolationMode: 'monotone' },
  },
  layout: { padding: 0 },
};

function getOptions(opts?: Partial<ChartOptions<'line'>>): ChartOptions<'line'> {
  return deepmerge(defaultOptions, opts ?? {});
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getDatasetColors(index: number) {
  const colors = [
    {
      borderColor: cssVar('--chart-series-1-border'),
      backgroundColor: cssVar('--chart-series-1-fill'),
    },
    {
      borderColor: cssVar('--chart-series-2-border'),
      backgroundColor: cssVar('--chart-series-2-fill'),
    },
  ];

  return colors[index];
}

function getThemeOverrides(): Partial<ChartOptions<'line'>> {
  const gridColor = cssVar('--chart-grid-color');
  const tickColor = cssVar('--chart-tick-color');

  return {
    scales: {
      y: {
        grid: { display: true, color: gridColor },
        ticks: { color: tickColor },
        border: { color: gridColor },
      },
    },
  };
}

type ChartDatasetCallback = (value: ChartDataset<'line'>, index: number, isDark: boolean) => ChartDataset<'line'>;

function getEmptyData(label: string, sets = 1, callback?: ChartDatasetCallback, isDark = true): ChartData<'line'> {
  const next = callback || ((v: ChartDataset<'line'>) => v);

  return {
    datasets: Array(sets)
      .fill(0)
      .map((_, index) =>
        next(
          {
            fill: true,
            label,
            data: [],
            ...getDatasetColors(index),
          },
          index,
          isDark,
        ),
      ),
  };
}

const merge = deepmergeCustom({ mergeArrays: false });

interface UseChartOptions {
  sets: number;
  options?: Partial<ChartOptions<'line'>> | number;
  callback?: ChartDatasetCallback;
}

function useChart(label: string, opts?: UseChartOptions) {
  const isDark = useComputedColorScheme('dark') === 'dark';

  const options = useMemo(() => {
    const baseOptions =
      typeof opts?.options === 'number'
        ? getOptions({ scales: { y: { min: 0, suggestedMax: opts.options } } })
        : getOptions(opts?.options);
    return deepmerge(baseOptions, getThemeOverrides()) as ChartOptions<'line'>;
  }, [isDark]);

  const [data, setData] = useState(() => getEmptyData(label, opts?.sets || 1, opts?.callback, isDark));

  const callbackRef = useRef(opts?.callback);
  useEffect(() => {
    callbackRef.current = opts?.callback;
  });

  useEffect(() => {
    setData((state) => ({
      ...state,
      datasets: state.datasets.map((ds, index) => {
        const colors = getDatasetColors(index);
        if (callbackRef.current) {
          const result = callbackRef.current({ ...ds, ...colors, data: [] }, index, isDark);
          return { ...ds, ...colors, ...result, data: ds.data };
        }
        return { ...ds, ...colors };
      }),
    }));
  }, [isDark]);

  const push = (items: number | null | (number | null)[]) => {
    const time = Date.now();
    setData((state) =>
      merge(state, {
        datasets: (Array.isArray(items) ? items : [items]).map((item, index) => ({
          ...state.datasets[index],
          data: state.datasets[index]?.data?.concat({
            x: time,
            y: typeof item === 'number' ? Number(item.toFixed(2)) : item,
          }),
        })),
      }),
    );
  };

  const clear = () =>
    setData((state) =>
      merge(state, {
        datasets: state.datasets.map((value) => ({
          ...value,
          data: [],
        })),
      }),
    );

  return { props: { data, options }, push, clear };
}

function useChartTickLabel(label: string, max: number, tickLabel: string, roundTo?: number) {
  return useChart(label, {
    sets: 1,
    options: {
      scales: {
        y: {
          suggestedMax: max,
          ticks: {
            callback(value) {
              return `${roundTo ? Number(value).toFixed(roundTo) : value}${tickLabel}`;
            },
          },
        },
      },
    },
  });
}

export { getEmptyData, getOptions, useChart, useChartTickLabel };
