import { z } from 'zod';
import { serverResourceHistorySchema, serverResourceHistoryStatesSchema } from '@/lib/schemas/server/server.ts';
import { getTranslations } from '@/providers/TranslationProvider.tsx';

export const RESOURCE_HISTORY_MAX_POINTS = 2000;
export const RESOURCE_HISTORY_CHART_SYNC_ID = 'server-resource-history';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export interface ResourceHistoryRange {
  id: string;
  label: () => string;
  duration: number;
  points: number;
}

export interface ResourceHistoryTimeframe {
  range: ResourceHistoryRange;
  offset: number;
  start: Date;
  end: Date;
  points: number;
  pointWidth: number;
  now: number;
}

export type ResourceHistoryStates = z.infer<typeof serverResourceHistoryStatesSchema>;

export type ResourceHistoryRow = {
  t: number;
  covered: number;
  states: ResourceHistoryStates | null;
  sampledSeconds: number | null;
  cpuAverage: number | null;
  cpuMax: number | null;
  cpuLimit: number | null;
  memoryAverage: number | null;
  memoryMax: number | null;
  memoryLimit: number | null;
  disk: number | null;
  diskLimit: number | null;
  networkRxBytes: number | null;
  networkTxBytes: number | null;
  networkRx: number | null;
  networkTx: number | null;
};

export interface ResourceHistorySummary {
  uptime: number | null;
  cpuAverage: number | null;
  cpuMax: number | null;
  memoryAverage: number | null;
  memoryMax: number | null;
  disk: number | null;
  networkRxBytes: number | null;
  networkTxBytes: number | null;
}

export function getDefaultResourceHistoryRanges(): ResourceHistoryRange[] {
  const { t } = getTranslations();

  return [
    { id: '1h', label: () => t('pages.server.console.history.range.hours', { hours: 1 }), duration: HOUR, points: 120 },
    {
      id: '6h',
      label: () => t('pages.server.console.history.range.hours', { hours: 6 }),
      duration: 6 * HOUR,
      points: 144,
    },
    {
      id: '24h',
      label: () => t('pages.server.console.history.range.hours', { hours: 24 }),
      duration: DAY,
      points: 144,
    },
    {
      id: '7d',
      label: () => t('pages.server.console.history.range.days', { days: 7 }),
      duration: 7 * DAY,
      points: 168,
    },
    {
      id: '30d',
      label: () => t('pages.server.console.history.range.days', { days: 30 }),
      duration: 30 * DAY,
      points: 180,
    },
    {
      id: '1y',
      label: () => t('pages.server.console.history.range.years', { years: 1 }),
      duration: 365 * DAY,
      points: 365,
    },
  ];
}

/**
 * Splits `range` into whole-second points and anchors it to the point grid, so the window (and its
 * query key) only moves once a full point has passed. `offset` shifts the window back by whole ranges.
 */
export function getResourceHistoryTimeframe(
  range: ResourceHistoryRange,
  offset: number,
  now: number,
): ResourceHistoryTimeframe {
  const points = Math.min(Math.max(Math.round(range.points), 1), RESOURCE_HISTORY_MAX_POINTS);
  const pointWidth = Math.max(Math.round(range.duration / points / 1000), 1) * 1000;
  const duration = pointWidth * points;
  const end = Math.ceil(now / pointWidth) * pointWidth - offset * duration;

  return {
    range,
    offset,
    start: new Date(end - duration),
    end: new Date(end),
    points,
    pointWidth,
    now,
  };
}

function limitAt(
  limits: z.infer<typeof serverResourceHistorySchema>['limits'],
  at: number,
): z.infer<typeof serverResourceHistorySchema>['limits'][number] | null {
  let current = null;
  for (const limit of limits) {
    if (limit.since.getTime() > at) break;
    current = limit;
  }

  return current;
}

export function buildResourceHistoryRows(
  history: z.infer<typeof serverResourceHistorySchema>,
  timeframe: ResourceHistoryTimeframe,
  diskLimitBytes: number | null,
): ResourceHistoryRow[] {
  const limits = [...history.limits].sort((a, b) => a.since.getTime() - b.since.getTime());

  return history.points.map((point) => {
    const t = point.start.getTime();
    const covered = Math.max(Math.min(t + timeframe.pointWidth, timeframe.now) - t, 0);
    const seconds = covered / 1000;
    const limit = limitAt(limits, t);
    const rate = (bytes: number | null) => (bytes === null || seconds <= 0 ? null : (bytes * 8) / seconds);

    return {
      t,
      covered,
      states: point.states,
      sampledSeconds: point.sampledSeconds,
      cpuAverage: point.cpuAverage,
      cpuMax: point.cpuMax,
      cpuLimit: limit && limit.cpuLimit > 0 ? limit.cpuLimit : null,
      memoryAverage: point.memoryAverageBytes,
      memoryMax: point.memoryMaxBytes,
      memoryLimit: limit && limit.memoryLimitBytes > 0 ? limit.memoryLimitBytes : null,
      disk: point.diskBytes,
      diskLimit: point.diskBytes !== null && diskLimitBytes ? diskLimitBytes : null,
      networkRxBytes: point.networkRxBytes,
      networkTxBytes: point.networkTxBytes,
      networkRx: rate(point.networkRxBytes),
      networkTx: rate(point.networkTxBytes),
    };
  });
}

export function summarizeResourceHistory(rows: ResourceHistoryRow[]): ResourceHistorySummary {
  let running = 0;
  let known = 0;
  let sampled = 0;
  let cpuSum = 0;
  let memorySum = 0;
  let cpuMax: number | null = null;
  let memoryMax: number | null = null;
  let disk: number | null = null;
  let rx: number | null = null;
  let tx: number | null = null;

  for (const row of rows) {
    if (row.states) {
      running += row.states.running;
      known += row.states.offline + row.states.starting + row.states.stopping + row.states.running;
    }

    if (row.sampledSeconds && row.cpuAverage !== null && row.memoryAverage !== null) {
      sampled += row.sampledSeconds;
      cpuSum += row.cpuAverage * row.sampledSeconds;
      memorySum += row.memoryAverage * row.sampledSeconds;
    }

    if (row.cpuMax !== null) cpuMax = Math.max(cpuMax ?? 0, row.cpuMax);
    if (row.memoryMax !== null) memoryMax = Math.max(memoryMax ?? 0, row.memoryMax);
    if (row.disk !== null) disk = row.disk;
    if (row.networkRxBytes !== null) rx = (rx ?? 0) + row.networkRxBytes;
    if (row.networkTxBytes !== null) tx = (tx ?? 0) + row.networkTxBytes;
  }

  return {
    uptime: known > 0 ? running / known : null,
    cpuAverage: sampled > 0 ? cpuSum / sampled : null,
    cpuMax,
    memoryAverage: sampled > 0 ? memorySum / sampled : null,
    memoryMax,
    disk,
    networkRxBytes: rx,
    networkTxBytes: tx,
  };
}
