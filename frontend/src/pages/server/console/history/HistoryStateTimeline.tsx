import { faPowerOff } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import type { ResourceHistoryProps } from 'shared/src/registries/pages/server/console/history.ts';
import ChartBlock from '@/elements/charts/ChartBlock.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import { formatDateTime, formatMilliseconds } from '@/lib/format/time.ts';
import { ResourceHistoryStates } from '@/lib/resourceHistory.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const STATES = ['running', 'starting', 'stopping', 'offline'] as const satisfies (keyof ResourceHistoryStates)[];

function stateGradient(states: ResourceHistoryStates, width: number): string {
  const stops: string[] = [];
  let at = 0;
  for (const state of STATES) {
    if (states[state] <= 0) continue;
    const next = Math.min(at + (states[state] / width) * 100, 100);
    stops.push(`var(--color-server-status-${state}) ${at}% ${next}%`);
    at = next;
  }
  stops.push(`transparent ${at}%`);

  return `linear-gradient(to top, ${stops.join(', ')})`;
}

export default function HistoryStateTimeline({ timeframe, rows, summary, loading }: ResourceHistoryProps) {
  const { t } = useTranslations();
  const [hovered, setHovered] = useState<number | null>(null);

  const hoveredRow = hovered === null ? undefined : rows[hovered];
  const empty = !rows.some((row) => row.states);

  return (
    <ChartBlock
      icon={<FontAwesomeIcon icon={faPowerOff} />}
      title={t('pages.server.console.history.block.states', {})}
      value={
        summary.uptime === null
          ? undefined
          : t('pages.server.console.history.uptime', { percent: `${Number((summary.uptime * 100).toFixed(2))}%` })
      }
      overlayIcon={loading ? <Spinner size={24} /> : undefined}
      overlayLabel={
        empty
          ? t(loading ? 'pages.server.console.history.loading' : 'pages.server.console.history.noData', {})
          : undefined
      }
      bodyClassName='min-h-0'
    >
      <div
        className='relative flex h-10 w-full gap-px'
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const index = Math.floor(((event.clientX - bounds.left) / bounds.width) * rows.length);
          setHovered(Math.min(Math.max(index, 0), rows.length - 1));
        }}
        onPointerLeave={() => setHovered(null)}
        role='img'
        aria-label={t('pages.server.console.history.block.states', {})}
      >
        {rows.map((row) => (
          <div
            key={row.t}
            className='min-w-0 flex-1 rounded-[1px] bg-(--chart-grid-color)'
            style={row.states ? { backgroundImage: stateGradient(row.states, timeframe.pointWidth / 1000) } : undefined}
          />
        ))}
        {hovered !== null && rows.length > 0 && (
          <div
            className='pointer-events-none absolute inset-y-0 rounded-[1px] ring-2 ring-(--mantine-color-text)'
            style={{ left: `${(hovered / rows.length) * 100}%`, width: `${100 / rows.length}%` }}
          />
        )}
      </div>
      <div className='mt-2 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--mantine-color-dimmed)'>
        {hoveredRow ? (
          <>
            <span className='tabular-nums text-(--mantine-color-text)'>{formatDateTime(hoveredRow.t)}</span>
            {hoveredRow.states
              ? STATES.filter((state) => hoveredRow.states![state] > 0).map((state) => (
                  <span key={state} className='flex items-center gap-1.5'>
                    <span
                      className='size-2 rounded-full'
                      style={{ backgroundColor: `var(--color-server-status-${state})` }}
                    />
                    {t(`common.enum.serverState.${state}`, {})}
                    <span className='tabular-nums'>{formatMilliseconds(hoveredRow.states![state] * 1000)}</span>
                  </span>
                ))
              : t('common.enum.serverState.unknown', {})}
          </>
        ) : (
          STATES.map((state) => (
            <span key={state} className='flex items-center gap-1.5'>
              <span
                className='size-2 rounded-full'
                style={{ backgroundColor: `var(--color-server-status-${state})` }}
              />
              {t(`common.enum.serverState.${state}`, {})}
            </span>
          ))
        )}
      </div>
    </ChartBlock>
  );
}
