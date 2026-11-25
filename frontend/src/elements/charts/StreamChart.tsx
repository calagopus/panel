import { faArrowUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { AreaChart, ChartTooltip } from '@mantine/charts';
import { useReducedMotion } from '@mantine/hooks';
import { CSSProperties, PointerEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { makeComponentHookable } from 'shared';
import { CHART_TICK, CHART_WINDOW, StreamChartProps, StreamChartSeries } from '@/lib/chart.ts';
import { useChartSync } from '@/providers/contexts/chartSyncContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

import '@mantine/charts/styles.css';

const PLOT_INSET = 3;
const EDGE = CHART_TICK * 1.5;
const TOOLTIP_GAP = 12;
const SYNC_TOLERANCE = CHART_TICK * 0.75;
const CEILING_DURATION = 500;

function formatOffset(at: number, end: number): string {
  const seconds = Math.round((at - end) / 1000);
  return seconds >= 0 ? 'now' : `${seconds}s`;
}

function chartLinesKey(series: StreamChartSeries[]): string {
  return series
    .map((entry) =>
      entry.hidden ? '' : `${entry.key}\u0000${entry.label}\u0000${entry.color}\u0000${entry.dash ?? ''}`,
    )
    .join('\u0001');
}

function toChartLines(series: StreamChartSeries[]) {
  return series
    .filter((entry) => !entry.hidden)
    .map((entry) => ({
      name: entry.key,
      label: entry.label,
      color: entry.color,
      strokeDasharray: entry.dash,
    }));
}

function plotY(value: number, max: number, plotHeight: number): number {
  return PLOT_INSET + (1 - value / max) * plotHeight;
}

function StreamChart({ data, domain, ticks, yMax, series, format, highlighted, limit, compact }: StreamChartProps) {
  const { t } = useTranslations();
  const sync = useChartSync();
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const previousEnd = useRef<number | null>(null);
  const scrollAnimation = useRef<{ animation: Animation; offset: number } | null>(null);
  const hoverFrame = useRef(0);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const hoverSource = useRef({ data, start: domain[0], width: 0, keys: [] as string[] });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [hoveredAt, setHoveredAt] = useState<number | null>(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });
  const [displayMax, setDisplayMax] = useState(yMax);
  const displayMaxRef = useRef(yMax);
  const reducedMotion = useReducedMotion();

  const [start, end] = domain;

  useEffect(() => {
    const element = viewport.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const edgePixels = (size.width * EDGE) / CHART_WINDOW;
  const plotHeight = Math.max(size.height - PLOT_INSET * 2, 0);
  const toY = (value: number) => `calc(${PLOT_INSET}px + (1 - ${value} / var(--chart-max)) * ${plotHeight}px)`;
  const toClampedY = (value: number) =>
    `calc(${PLOT_INSET}px + (1 - min(${value}, var(--chart-max)) / var(--chart-max)) * ${plotHeight}px)`;

  useLayoutEffect(() => {
    const from = displayMaxRef.current;

    const apply = (value: number) => {
      displayMaxRef.current = value;
      root.current?.style.setProperty('--chart-max', String(value));
      if (plot.current) {
        plot.current.style.transform = value === yMax ? '' : `scaleY(${yMax / value})`;
      }
    };

    if (reducedMotion || from <= 0 || from === yMax) {
      apply(yMax);
      setDisplayMax(yMax);
      return;
    }

    apply(from);

    let frame = 0;
    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(Math.max((now - startedAt) / CEILING_DURATION, 0), 1);
      const eased = 1 - (1 - progress) ** 3;

      apply(from + (yMax - from) * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        setDisplayMax(yMax);
      }
    };
    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [yMax, reducedMotion]);

  const linesKey = chartLinesKey(series);
  const [lines, setLines] = useState(() => ({ key: linesKey, series: toChartLines(series) }));
  if (lines.key !== linesKey) {
    setLines({ key: linesKey, series: toChartLines(series) });
  }

  useLayoutEffect(() => {
    hoverSource.current = { data, start, width: size.width, keys: lines.series.map((entry) => entry.name) };
  }, [data, start, size.width, lines.series]);

  const updateHover = () => {
    const at = pointerRef.current;
    const { data, start, width, keys } = hoverSource.current;
    if (!at || width === 0) {
      return;
    }

    const scroll = scrollAnimation.current;
    const progress = scroll?.animation.effect?.getComputedTiming().progress ?? 1;
    const shift = scroll ? scroll.offset * (1 - progress) : 0;
    const time = start + ((at.x - shift) * CHART_WINDOW) / width;

    let nearest: number | null = null;
    for (const row of data) {
      if (!keys.some((key) => row[key] !== null && row[key] !== undefined)) {
        continue;
      }
      if (nearest === null || Math.abs(row.t! - time) < Math.abs(nearest - time)) {
        nearest = row.t!;
      }
    }

    setHoveredAt(nearest);
  };

  const followHover = () => {
    cancelAnimationFrame(hoverFrame.current);
    hoverFrame.current = 0;

    const step = () => {
      updateHover();
      hoverFrame.current =
        pointerRef.current && scrollAnimation.current?.animation.playState === 'running'
          ? requestAnimationFrame(step)
          : 0;
    };
    step();
  };

  useEffect(() => () => cancelAnimationFrame(hoverFrame.current), []);

  useLayoutEffect(() => {
    const from = previousEnd.current;
    previousEnd.current = end;

    const step = from === null ? 0 : end - from;
    if (step > 0 && step <= CHART_WINDOW && size.width > 0 && scroller.current) {
      const travel = Math.min(step, EDGE);
      const offset = (size.width * travel) / CHART_WINDOW;
      const timing = { duration: travel, easing: 'linear', fill: 'forwards' } as const;

      scrollAnimation.current = {
        animation: scroller.current.animate([{ transform: `translateX(${offset}px)` }, { transform: 'none' }], timing),
        offset,
      };
    }

    if (pointerRef.current) {
      followHover();
    }
  }, [end, size.width]);

  const hovering = pointer !== null;

  useEffect(() => {
    if (!sync || !hovering || hoveredAt === null) {
      return;
    }

    sync.setAt(hoveredAt);
    return () => sync.setAt(null);
  }, [sync?.setAt, hovering, hoveredAt]);

  const syncedAt = hovering ? null : (sync?.at ?? null);
  let syncedRow: Record<string, number | null> | undefined;
  if (syncedAt !== null) {
    for (const row of data) {
      const distance = Math.abs(row.t! - syncedAt);
      if (distance <= SYNC_TOLERANCE && (!syncedRow || distance < Math.abs(syncedRow.t! - syncedAt))) {
        syncedRow = row;
      }
    }
  }

  const hoveredRow = hovering ? (hoveredAt === null ? undefined : data.find((row) => row.t === hoveredAt)) : syncedRow;
  const payload = hoveredRow
    ? lines.series
        .filter((entry) => hoveredRow[entry.name] !== null && hoveredRow[entry.name] !== undefined)
        .map((entry) => ({ name: entry.name, dataKey: entry.name, color: entry.color, payload: hoveredRow }))
    : [];

  const tooltipShown = hovering && hoveredRow !== undefined && payload.length > 0;

  useLayoutEffect(() => {
    const element = tooltip.current;
    if (!tooltipShown || !element) {
      return;
    }

    const measure = () => {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      setTooltipSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    };
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [tooltipShown]);

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const next = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    pointerRef.current = next;
    setPointer(next);
    if (!hoverFrame.current) {
      followHover();
    }
  };

  const onPointerLeave = () => {
    pointerRef.current = null;
    cancelAnimationFrame(hoverFrame.current);
    hoverFrame.current = 0;
    setPointer(null);
    setHoveredAt(null);
  };

  const labels = useMemo(() => {
    const seen = new Set<string>();

    return ticks
      .map((value) => ({ value, text: format(value) }))
      .filter((tick) => {
        if (seen.has(tick.text)) {
          return false;
        }
        seen.add(tick.text);
        return true;
      });
  }, [ticks, format]);

  const labelsKey = labels.map((tick) => tick.text).join('|');
  const [previousLabels, setPreviousLabels] = useState({ key: labelsKey, labels });
  const [leavingLabels, setLeavingLabels] = useState<typeof labels>([]);

  if (previousLabels.key !== labelsKey) {
    const current = new Set(labels.map((tick) => tick.text));
    const leaving = [...leavingLabels, ...previousLabels.labels].filter(
      (tick, index, all) => !current.has(tick.text) && all.findIndex((other) => other.text === tick.text) === index,
    );

    setPreviousLabels({ key: labelsKey, labels });
    setLeavingLabels(leaving);
  }

  useEffect(() => {
    if (leavingLabels.length === 0) {
      return;
    }

    const timeout = setTimeout(() => setLeavingLabels([]), CEILING_DURATION);

    return () => clearTimeout(timeout);
  }, [leavingLabels]);

  const shownLabels = [
    ...labels.map((tick) => ({ ...tick, visible: tick.value <= displayMax * 1.001 })),
    ...leavingLabels.map((tick) => ({ ...tick, visible: false })),
  ];

  const pointerY = pointer ? Math.min(Math.max(pointer.y, PLOT_INSET), PLOT_INSET + plotHeight) : 0;
  const pointerValue = plotHeight > 0 ? (1 - (pointerY - PLOT_INSET) / plotHeight) * displayMax : 0;
  const hoveredX = hoveredRow ? ((hoveredRow.t! - start) * size.width) / CHART_WINDOW + edgePixels : 0;

  const tooltipLeft = pointer
    ? pointer.x + TOOLTIP_GAP + tooltipSize.width > size.width
      ? Math.max(pointer.x - TOOLTIP_GAP - tooltipSize.width, 0)
      : pointer.x + TOOLTIP_GAP
    : 0;
  const tooltipTop = pointer
    ? Math.min(Math.max(pointer.y - tooltipSize.height / 2, 0), Math.max(size.height - tooltipSize.height, 0))
    : 0;

  return (
    <div ref={root} className='flex h-full w-full' style={{ '--chart-max': displayMax } as CSSProperties}>
      <div className={compact ? 'hidden' : 'relative w-18 shrink-0'}>
        {shownLabels.map((tick) => (
          <span
            key={tick.text}
            className='absolute right-2 -translate-y-1/2 whitespace-nowrap text-xs text-(--chart-tick-color) tabular-nums transition-opacity'
            style={{ top: toY(tick.value), opacity: tick.visible ? 1 : 0 }}
          >
            {tick.text}
          </span>
        ))}
        {pointer && (
          <span
            className='absolute right-1 z-10 -translate-y-1/2 whitespace-nowrap rounded-sm bg-(--mantine-color-body) px-1 text-xs tabular-nums ring-1 ring-(--mantine-color-default-border)'
            style={{ top: pointerY }}
          >
            {format(pointerValue)}
          </span>
        )}
      </div>

      <div
        ref={viewport}
        className={compact ? 'relative min-w-0 flex-1' : 'relative min-w-0 flex-1 cursor-crosshair touch-pan-y'}
        onPointerMove={compact ? undefined : onPointerMove}
        onPointerLeave={compact ? undefined : onPointerLeave}
      >
        {!compact &&
          shownLabels.map((tick) => (
            <div
              key={tick.text}
              className='pointer-events-none absolute inset-x-0 border-t border-(--chart-grid-color) transition-opacity'
              style={{ top: toY(tick.value), opacity: tick.visible ? 1 : 0 }}
            />
          ))}

        {limit !== null && limit !== undefined && limit > 0 && limit <= yMax && (
          <div
            className='pointer-events-none absolute inset-x-0 border-t border-dashed border-(--mantine-color-red-filled)/70'
            style={{ top: `max(${toY(limit)}, 0px)` }}
          >
            <span
              className={`absolute right-1 whitespace-nowrap text-[10px] text-(--mantine-color-red-filled) tabular-nums ${plotY(limit, displayMax, plotHeight) < 16 ? 'top-0.5' : 'bottom-0.5'}`}
            >
              {t('common.stat.limit', { limit: format(limit) })}
            </span>
          </div>
        )}
        {limit !== null && limit !== undefined && limit > yMax && (
          <span className='pointer-events-none absolute top-0 right-1 whitespace-nowrap text-[10px] text-(--mantine-color-dimmed) tabular-nums'>
            <FontAwesomeIcon icon={faArrowUp} className='mr-1' />
            {t('common.stat.limit', { limit: format(limit) })}
          </span>
        )}

        <div className='pointer-events-none absolute inset-0' style={{ clipPath: 'inset(-100% 0px -100% 0px)' }}>
          <div
            ref={scroller}
            className='absolute inset-y-0 will-change-transform'
            style={{ left: -edgePixels, width: size.width + edgePixels * 2 }}
          >
            {size.width > 0 && (
              <div className='overflow-hidden'>
                <div ref={plot} style={{ transformOrigin: `0 ${size.height - PLOT_INSET}px` }}>
                  <AreaChart
                    h={size.height}
                    data={data}
                    dataKey='t'
                    series={lines.series}
                    curveType='monotone'
                    withGradient
                    fillOpacity={0.25}
                    strokeWidth={2}
                    withDots={false}
                    withXAxis={false}
                    withYAxis={false}
                    withTooltip={false}
                    gridAxis='none'
                    connectNulls={false}
                    xAxisProps={{
                      type: 'number',
                      domain: [start - EDGE, end + EDGE],
                      allowDataOverflow: true,
                      hide: true,
                      tick: false,
                    }}
                    yAxisProps={{ domain: [0, yMax], allowDataOverflow: true, hide: true, tick: false }}
                    rightYAxisProps={{ tick: false }}
                    areaProps={(entry) => ({
                      isAnimationActive: false,
                      fillOpacity: highlighted && highlighted !== entry.name ? 0 : 1,
                      strokeOpacity: highlighted && highlighted !== entry.name ? 0.3 : 1,
                    })}
                    areaChartProps={{ margin: { top: PLOT_INSET, right: 0, bottom: PLOT_INSET, left: 0 } }}
                  />
                </div>
              </div>
            )}

            {hoveredRow && (
              <>
                <div
                  className='absolute inset-y-0 border-l border-dashed border-(--chart-tick-color)'
                  style={{ left: hoveredX }}
                />
                {payload.map((item) => (
                  <span
                    key={item.name}
                    className='absolute size-2.5 -translate-1/2 rounded-full border-2 border-(--mantine-color-body)'
                    style={{
                      left: hoveredX,
                      top: toClampedY(hoveredRow[item.name]!),
                      backgroundColor: item.color,
                      opacity: highlighted && highlighted !== item.name ? 0.3 : 1,
                    }}
                  />
                ))}
                {!hovering && payload.length > 0 && (
                  <span
                    className={`absolute top-1 flex gap-2 whitespace-nowrap rounded-sm bg-(--mantine-color-body) px-1 text-[10px] tabular-nums ring-1 ring-(--mantine-color-default-border) ${hoveredX - edgePixels > size.width / 2 ? '-translate-x-[calc(100%+6px)]' : 'translate-x-1.5'}`}
                    style={{ left: hoveredX }}
                  >
                    {payload.map((item) => (
                      <span key={item.name} style={{ color: payload.length > 1 ? item.color : undefined }}>
                        {format(hoveredRow[item.name]!)}
                      </span>
                    ))}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {pointer && (
          <div
            className='pointer-events-none absolute inset-x-0 border-t border-dashed border-(--chart-tick-color)'
            style={{ top: pointerY }}
          />
        )}

        {tooltipShown && (
          <div
            ref={tooltip}
            className='pointer-events-none absolute z-10'
            style={{ left: tooltipLeft, top: tooltipTop }}
          >
            <ChartTooltip
              label={formatOffset(hoveredRow.t!, end)}
              payload={payload}
              series={lines.series}
              valueFormatter={format}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default makeComponentHookable(StreamChart);
