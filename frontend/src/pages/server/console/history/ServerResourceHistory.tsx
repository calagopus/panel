import { faChevronLeft, faChevronRight, faClockRotateLeft, faForwardFast } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import classNames from 'classnames';
import { FC, memo, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ResourceHistoryItem, ResourceHistoryProps } from 'shared/src/registries/pages/server/console/history.ts';
import { httpErrorToHuman } from '@/api/axios.ts';
import getResourceHistory from '@/api/server/resources/getResourceHistory.ts';
import ActionIcon from '@/elements/buttons/ActionIcon.tsx';
import ServerContentContainer from '@/elements/containers/ServerContentContainer.tsx';
import ExtensionSlot from '@/elements/ExtensionSlot.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import ErrorState from '@/elements/feedback/ErrorState.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import DateTimePicker from '@/elements/input/DateTimePicker.tsx';
import Divider from '@/elements/layout/Divider.tsx';
import SegmentedControl from '@/elements/layout/SegmentedControl.tsx';
import Tooltip from '@/elements/overlays/Tooltip.tsx';
import { mbToBytes } from '@/lib/format/size.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import {
  buildResourceHistoryRows,
  getDefaultResourceHistoryRanges,
  getResourceHistoryTimeframe,
  ResourceHistoryTimeframe,
  summarizeResourceHistory,
} from '@/lib/resourceHistory.ts';
import { useResource } from '@/plugins/resource/useResource.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { HistoryCpuBlock, HistoryDiskBlock, HistoryMemoryBlock, HistoryNetworkBlock } from './HistoryChartBlocks.tsx';
import HistoryStateTimeline from './HistoryStateTimeline.tsx';
import {
  HistoryCpuCard,
  HistoryDiskCard,
  HistoryMemoryCard,
  HistoryNetworkCard,
  HistoryUptimeCard,
} from './HistorySummaryCards.tsx';

const DEFAULT_RANGE = '24h';
const MIN_REFRESH = 15_000;

const HistoryItemContent = memo(function HistoryItemContent({
  component: Component,
  props,
}: {
  component: FC<ResourceHistoryProps>;
  props: ResourceHistoryProps;
}) {
  return <Component {...props} />;
});

function HistoryItems({
  items,
  props,
  pending,
  spinner,
  className,
}: {
  items: ResourceHistoryItem[];
  props: ResourceHistoryProps;
  pending: boolean;
  spinner?: boolean;
  className: string;
}) {
  return (
    <div className={className}>
      {items.map(({ id, component, fullWidth }) => (
        <div key={id} className={classNames('relative min-w-0', fullWidth && 'col-span-full')}>
          <div className={classNames('h-full transition-opacity', pending && 'pointer-events-none opacity-50')}>
            <HistoryItemContent component={component} props={props} />
          </div>
          {pending && spinner && (
            <div className='pointer-events-none absolute inset-0 z-20 flex items-center justify-center'>
              <Spinner />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TimeframePicker({
  label,
  value,
  maxDate,
  onCommit,
}: {
  label: string;
  value: Date;
  maxDate: Date;
  onCommit: (value: number) => void;
}) {
  const draft = useRef(value);

  return (
    <DateTimePicker
      aria-label={label}
      placeholder={label}
      className='w-48'
      defaultValue={value}
      maxDate={maxDate}
      onChange={(next) => {
        if (next) draft.current = new Date(next);
      }}
      onDropdownClose={() => {
        if (draft.current.getTime() !== value.getTime()) onCommit(draft.current.getTime());
      }}
    />
  );
}

function parseStart(value: string | null): number | null {
  if (!value) return null;

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveItems(
  stock: ResourceHistoryItem[],
  added: ResourceHistoryItem[],
  interceptors: ((items: ResourceHistoryItem[], props: ResourceHistoryProps) => void)[],
  props: ResourceHistoryProps,
): ResourceHistoryItem[] {
  const items = [...stock, ...added];
  for (const interceptor of interceptors) {
    interceptor(items, props);
  }

  return items;
}

const stockSummaryCards: ResourceHistoryItem[] = [
  { id: 'uptime', component: HistoryUptimeCard },
  { id: 'cpu', component: HistoryCpuCard },
  { id: 'memory', component: HistoryMemoryCard },
  { id: 'network', component: HistoryNetworkCard },
  { id: 'disk', component: HistoryDiskCard },
];

const stockBlocks: ResourceHistoryItem[] = [
  { id: 'states', component: HistoryStateTimeline, fullWidth: true },
  { id: 'cpu', component: HistoryCpuBlock },
  { id: 'memory', component: HistoryMemoryBlock },
  { id: 'network', component: HistoryNetworkBlock },
  { id: 'disk', component: HistoryDiskBlock },
];

export default function ServerResourceHistory() {
  const { t } = useTranslations();
  const server = useServerStore((state) => state.server);
  const registry = window.extensionContext.extensionRegistry.pages.server.console.history;
  const [searchParams, setSearchParams] = useSearchParams();
  const [now, setNow] = useState(() => Date.now());
  const [requested, setRequested] = useState<{ range: string; start: number | null } | null>(null);
  const queryClient = useQueryClient();

  const ranges = getDefaultResourceHistoryRanges();
  for (const interceptor of registry.rangeInterceptors) {
    interceptor(ranges);
  }

  const range =
    ranges.find((entry) => entry.id === searchParams.get('range')) ??
    ranges.find((entry) => entry.id === DEFAULT_RANGE) ??
    ranges[0];
  const start = parseStart(searchParams.get('start'));
  const timeframe = getResourceHistoryTimeframe(range, start, now);

  useEffect(() => {
    if (!timeframe.live) return;

    const interval = setInterval(() => setNow(Date.now()), Math.max(timeframe.pointWidth, MIN_REFRESH));
    return () => clearInterval(interval);
  }, [timeframe.live, timeframe.pointWidth]);

  const historyQuery = (frame: ResourceHistoryTimeframe) => ({
    queryKey: queryKeys.server(server.uuid).resources.history(frame.start.getTime(), frame.end.getTime(), frame.points),
    queryFn: () =>
      getResourceHistory(server.uuid, frame.start, frame.end, frame.points).then((history) => ({
        timeframe: frame,
        history,
      })),
  });

  const { data, loading, error, refetch } = useResource({
    ...historyQuery(timeframe),
    keepPrevious: true,
    silent: true,
  });
  const history = data?.history;
  const shown = data?.timeframe ?? timeframe;
  const selected = requested ?? { range: range.id, start: timeframe.live ? null : timeframe.start.getTime() };
  const selectedFrame = getResourceHistoryTimeframe(
    ranges.find((entry) => entry.id === selected.range) ?? range,
    selected.start,
    now,
  );
  const selectedDuration = selectedFrame.end.getTime() - selectedFrame.start.getTime();
  const pending =
    !!data && (shown.range.id !== selected.range || (shown.live ? null : shown.start.getTime()) !== selected.start);

  useEffect(() => setRequested(null), [range.id, start]);

  const selectTimeframe = (rangeId: string, nextStart: number | null) => {
    const at = Date.now();
    const nextRange = ranges.find((entry) => entry.id === rangeId) ?? range;
    const frame = getResourceHistoryTimeframe(nextRange, nextStart, at);
    const frameStart = frame.live ? null : frame.start.getTime();

    setRequested({ range: rangeId, start: frameStart });
    queryClient.prefetchQuery(historyQuery(frame));

    startTransition(() => setNow(at));
    setSearchParams(
      (params) => {
        params.set('range', rangeId);
        params.delete('offset');
        if (frameStart !== null) {
          params.set('start', new Date(frameStart).toISOString().replace(/\.\d{3}Z$/, 'Z'));
        } else {
          params.delete('start');
        }
        return params;
      },
      { replace: true },
    );
  };

  const diskLimit = server.limits.disk > 0 ? mbToBytes(server.limits.disk) : null;
  const rows = useMemo(
    () => (history ? buildResourceHistoryRows(history, shown, diskLimit) : []),
    [history, shown, diskLimit],
  );
  const summary = useMemo(() => summarizeResourceHistory(rows), [rows]);
  const props = useMemo<ResourceHistoryProps>(
    () => ({ timeframe: shown, history, rows, summary, loading }),
    [shown, history, rows, summary, loading],
  );

  const unavailable = isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 417);

  return (
    <ServerContentContainer title={t('pages.server.console.history.title', {})} registry={registry.container}>
      {unavailable ? (
        <EmptyState
          icon={faClockRotateLeft}
          title={t('pages.server.console.history.unavailable.title', {})}
          description={t('pages.server.console.history.unavailable.description', {})}
        />
      ) : error && !loading && (!history || pending) ? (
        <ErrorState error={httpErrorToHuman(error)} onRetry={refetch} retrying={loading} />
      ) : (
        <>
          <div className='mb-4 flex flex-wrap items-center gap-2'>
            <SegmentedControl
              value={selected.range}
              onChange={(value) => {
                const nextRange = ranges.find((entry) => entry.id === value);
                selectTimeframe(
                  value,
                  selectedFrame.live || !nextRange ? null : selectedFrame.end.getTime() - nextRange.duration,
                );
              }}
              data={ranges.map((entry) => ({ value: entry.id, label: entry.label() }))}
            />
            <div className='flex items-center gap-1'>
              <Tooltip label={t('pages.server.console.history.tooltip.earlier', {})}>
                <ActionIcon
                  variant='default'
                  size='lg'
                  onClick={() => selectTimeframe(selected.range, selectedFrame.start.getTime() - selectedDuration)}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('pages.server.console.history.tooltip.later', {})}>
                <ActionIcon
                  variant='default'
                  size='lg'
                  disabled={selectedFrame.live}
                  onClick={() => selectTimeframe(selected.range, selectedFrame.start.getTime() + selectedDuration)}
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('pages.server.console.history.tooltip.latest', {})}>
                <ActionIcon
                  variant='default'
                  size='lg'
                  disabled={selectedFrame.live}
                  onClick={() => selectTimeframe(selected.range, null)}
                >
                  <FontAwesomeIcon icon={faForwardFast} />
                </ActionIcon>
              </Tooltip>
            </div>
            <Divider orientation='vertical' className='hidden sm:block' />
            <div className='flex flex-wrap items-center gap-2'>
              <TimeframePicker
                key={`start-${selectedFrame.start.getTime()}`}
                label={t('pages.server.console.history.timeframeStart', {})}
                value={selectedFrame.start}
                maxDate={new Date(now)}
                onCommit={(value) => selectTimeframe(selected.range, value)}
              />
              <span className='text-sm text-(--mantine-color-dimmed)'>
                {t('pages.server.console.history.timeframeTo', {})}
              </span>
              <TimeframePicker
                key={`end-${selectedFrame.end.getTime()}`}
                label={t('pages.server.console.history.timeframeEnd', {})}
                value={new Date(Math.min(selectedFrame.end.getTime(), now))}
                maxDate={new Date(now)}
                onCommit={(value) => selectTimeframe(selected.range, value - selectedDuration)}
              />
            </div>
            <div className='ml-auto flex items-center gap-2'>
              <ExtensionSlot
                components={registry.headerComponents.prependedComponents}
                name='resource-history-header-prepended'
                props={props}
              />
              <ExtensionSlot
                components={registry.headerComponents.appendedComponents}
                name='resource-history-header-appended'
                props={props}
              />
            </div>
          </div>

          <HistoryItems
            items={resolveItems(stockSummaryCards, registry.summaryCards, registry.summaryCardInterceptors, props)}
            props={props}
            pending={pending}
            className='mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5'
          />

          <HistoryItems
            items={resolveItems(stockBlocks, registry.blocks, registry.blockInterceptors, props)}
            props={props}
            pending={pending}
            spinner
            className='grid grid-cols-1 gap-4 xl:grid-cols-2'
          />
        </>
      )}
    </ServerContentContainer>
  );
}
