import { faArrowsToDot, faMagnifyingGlassMinus, faMagnifyingGlassPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ReactZoomPanPinchRef,
  TransformComponent,
  TransformWrapper,
  useControls,
  useTransformEffect,
} from 'react-zoom-pan-pinch';
import ActionIcon from '@/elements/ActionIcon.tsx';
import ContextMenu, { ContextMenuItem } from '@/elements/ContextMenu.tsx';
import Group from '@/elements/Group.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { INBOUND_COLOR, OUTBOUND_COLOR } from './directions.ts';

const NODE_WIDTH = 288;
const COLUMN_GAP = 260;
const ROW_GAP = 24;
const MIN_SCALE = 0.35;
const FIT_PADDING = 32;
const MIN_CANVAS_HEIGHT = 400;
const EDGE_OFFSET = 14;
const EDGE_GAP = 6;

export type CanvasEdge = {
  active: boolean;
  label: string;
  description: string;
  onActivate?: () => void;
};

export type CanvasNode = {
  key: string;
  column: 0 | 1;
  edges?: { outbound: CanvasEdge; inbound: CanvasEdge };
  render: (measure: (element: HTMLDivElement | null) => void) => ReactNode;
};

type Placed = CanvasNode & { x: number; y: number; height: number };
type Point = { x: number; y: number };

/**
 * Two columns, this server and its peers, because direction is carried by the pair of edges
 * drawn to each peer rather than by which side of the graph the peer sits on.
 */
function layout(
  nodes: CanvasNode[],
  heights: Record<string, number>,
): { placed: Placed[]; width: number; height: number } {
  const columns: Record<number, CanvasNode[]> = { 0: [], 1: [] };
  for (const node of nodes) {
    columns[node.column].push(node);
  }

  const heightOf = (node: CanvasNode) => heights[node.key] ?? 120;
  const columnHeight = (column: CanvasNode[]) =>
    column.reduce((total, node) => total + heightOf(node) + ROW_GAP, -ROW_GAP);

  const tallest = Math.max(...Object.values(columns).map((column) => (column.length ? columnHeight(column) : 0)), 0);
  const placed: Placed[] = [];
  // an empty side must not reserve a column, or the whole graph sits off to one edge
  const occupied = ([0, 1] as const).filter((key) => columns[key].length > 0);

  occupied.forEach((key, index) => {
    let y = (tallest - columnHeight(columns[key])) / 2;
    for (const node of columns[key]) {
      const height = heightOf(node);
      placed.push({ ...node, x: index * (NODE_WIDTH + COLUMN_GAP), y, height });
      y += height + ROW_GAP;
    }
  });

  return {
    placed,
    width: Math.max(occupied.length * NODE_WIDTH + Math.max(occupied.length - 1, 0) * COLUMN_GAP, 1),
    height: Math.max(tallest, 1),
  };
}

/**
 * Signed, so an edge running right to left bows the same way it travels. An unsigned offset
 * points the arrowhead back the way it came and hides it underneath the card.
 */
function controlOffset(from: Point, to: Point) {
  return Math.max(Math.abs(to.x - from.x) / 2, 60) * (Math.sign(to.x - from.x) || 1);
}

function edgePath(from: Point, to: Point) {
  const delta = controlOffset(from, to);

  return `M ${from.x} ${from.y} C ${from.x + delta} ${from.y}, ${to.x - delta} ${to.y}, ${to.x} ${to.y}`;
}

/** The cubic's midpoint, which is where a label sits clear of both endpoints. */
function edgeMidpoint(from: Point, to: Point): Point {
  const delta = controlOffset(from, to);

  return {
    x: (from.x + 3 * (from.x + delta) + 3 * (to.x - delta) + to.x) / 8,
    y: (from.y + 3 * from.y + 3 * to.y + to.y) / 8,
  };
}

function Edge({
  edge,
  from,
  to,
  color,
  marker,
}: {
  edge: CanvasEdge;
  from: Point;
  to: Point;
  color: string;
  marker: string;
}) {
  const path = edgePath(from, to);
  const mid = edgeMidpoint(from, to);
  const interactive = Boolean(edge.onActivate);

  return (
    <g opacity={edge.active ? 1 : 0.4}>
      <path
        d={path}
        fill='none'
        stroke={color}
        strokeWidth={2}
        strokeDasharray={edge.active ? undefined : '6 6'}
        markerEnd={`url(#${marker})`}
      />

      <text
        x={mid.x}
        y={mid.y}
        textAnchor='middle'
        dominantBaseline='middle'
        fontSize={12}
        fill={color}
        stroke='var(--mantine-color-body)'
        strokeWidth={4}
        paintOrder='stroke'
        className='pointer-events-none select-none'
      >
        {edge.label}
      </text>

      {interactive && (
        <path
          d={path}
          fill='none'
          stroke='transparent'
          strokeWidth={20}
          tabIndex={0}
          role='button'
          className='cursor-pointer focus:outline-none focus-visible:stroke-(--mantine-primary-color-filled)'
          onClick={edge.onActivate}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              edge.onActivate?.();
            }
          }}
        >
          <title>{edge.description}</title>
        </path>
      )}
    </g>
  );
}

function Controls({ onFit }: { onFit: () => void }) {
  const { t } = useTranslations();
  const { zoomIn, zoomOut } = useControls();

  return (
    <Group gap={4} className='absolute bottom-3 right-3 z-10'>
      <Tooltip label={t('pages.server.tunnel.canvas.zoomOut', {})}>
        <ActionIcon variant='default' onClick={() => zoomOut()}>
          <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('pages.server.tunnel.canvas.zoomIn', {})}>
        <ActionIcon variant='default' onClick={() => zoomIn()}>
          <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('pages.server.tunnel.canvas.fit', {})}>
        <ActionIcon variant='default' onClick={onFit}>
          <FontAwesomeIcon icon={faArrowsToDot} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

function Legend() {
  const { t } = useTranslations();

  const entries = [
    { color: OUTBOUND_COLOR, label: t('pages.server.tunnel.canvas.legend.outbound', {}) },
    { color: INBOUND_COLOR, label: t('pages.server.tunnel.canvas.legend.inbound', {}) },
  ];

  return (
    <Group gap='sm' className='absolute left-3 top-3 z-10 rounded-md bg-(--mantine-color-body)/80 px-2 py-1'>
      {entries.map((entry) => (
        <span key={entry.label} className='flex items-center gap-1.5 text-xs whitespace-nowrap'>
          <svg width={14} height={2} viewBox='0 0 14 2' className='shrink-0 overflow-visible' aria-hidden>
            <line x1={1} y1={1} x2={13} y2={1} stroke={entry.color} strokeWidth={2} strokeLinecap='round' />
          </svg>
          {entry.label}
        </span>
      ))}
    </Group>
  );
}

/**
 * The dots live outside the transformed layer and are moved with it instead, so panning a
 * large graph never grows a huge background image.
 */
function Dots() {
  const ref = useRef<HTMLDivElement>(null);

  useTransformEffect(({ state }) => {
    if (!ref.current) return;

    ref.current.style.backgroundSize = `${24 * state.scale}px ${24 * state.scale}px`;
    ref.current.style.backgroundPosition = `${state.positionX}px ${state.positionY}px`;
  });

  return (
    <div
      ref={ref}
      aria-hidden
      className='pointer-events-none absolute inset-0 bg-[radial-gradient(var(--chart-grid-color)_1.5px,transparent_1.5px)]'
      style={{ backgroundSize: '24px 24px' }}
    />
  );
}

function CloseMenusOnPan({ onPan }: { onPan: () => void }) {
  useTransformEffect(() => onPan());

  return null;
}

export default function TunnelCanvas({
  nodes,
  items = [],
  onPan,
}: {
  nodes: CanvasNode[];
  items?: ContextMenuItem[];
  onPan: () => void;
}) {
  const { t } = useTranslations();
  const [heights, setHeights] = useState<Record<string, number>>({});
  const elements = useRef<Record<string, HTMLDivElement | null>>({});
  const controls = useRef<ReactZoomPanPinchRef>(null);

  const measure = (key: string) => (element: HTMLDivElement | null) => {
    elements.current[key] = element;
  };

  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    for (const [key, element] of Object.entries(elements.current)) {
      if (element) next[key] = element.offsetHeight;
    }

    setHeights((current) =>
      Object.keys(next).length === Object.keys(current).length &&
      Object.entries(next).every(([key, value]) => current[key] === value)
        ? current
        : next,
    );
  });

  const { placed, width, height } = layout(nodes, heights);
  const centre = placed.find((node) => node.column === 0);

  const fit = useCallback(() => {
    const wrapper = controls.current?.instance.wrapperComponent;
    if (!wrapper) return;

    const scale = Math.min(
      1,
      (wrapper.clientWidth - FIT_PADDING) / width,
      (wrapper.clientHeight - FIT_PADDING) / height,
    );

    controls.current?.centerView(Math.max(scale, MIN_SCALE), 0);
  }, [width, height]);

  useLayoutEffect(fit, [fit]);

  const backgroundItems = useMemo<ContextMenuItem[]>(
    () => [
      ...items,
      ...(items.some((item) => item.type === 'action' && !item.hidden && item.canAccess !== false)
        ? [{ type: 'divider' } as ContextMenuItem]
        : []),
      {
        type: 'action',
        icon: faArrowsToDot,
        label: t('pages.server.tunnel.canvas.fit', {}),
        onClick: fit,
        color: 'gray',
      },
      {
        type: 'action',
        icon: faMagnifyingGlassPlus,
        label: t('pages.server.tunnel.canvas.zoomIn', {}),
        onClick: () => controls.current?.zoomIn(),
        color: 'gray',
      },
      {
        type: 'action',
        icon: faMagnifyingGlassMinus,
        label: t('pages.server.tunnel.canvas.zoomOut', {}),
        onClick: () => controls.current?.zoomOut(),
        color: 'gray',
      },
    ],
    [items, fit, t],
  );

  return (
    <ContextMenu items={backgroundItems}>
      {({ openMenu }) => (
        <div
          className='relative w-full overflow-hidden rounded-md border border-(--chart-grid-color) bg-(--mantine-color-body) lg:h-[70vh]!'
          style={{ height: `min(70vh, max(${MIN_CANVAS_HEIGHT}px, ${height + FIT_PADDING * 2}px))` }}
          onContextMenu={(event) => {
            event.preventDefault();
            openMenu(event.clientX, event.clientY);
          }}
        >
          <TransformWrapper
            ref={controls}
            minScale={MIN_SCALE}
            maxScale={2}
            limitToBounds={false}
            doubleClick={{ disabled: true }}
            wheel={{ activationKeys: ['Control', 'Meta'] }}
            panning={{
              velocityDisabled: true,
              excluded: ['input', 'button', 'a', 'textarea'],
            }}
          >
            <Dots />
            <CloseMenusOnPan onPan={onPan} />
            {placed.some((node) => node.edges) && <Legend />}
            <Controls onFit={fit} />

            <TransformComponent wrapperClass='h-full! w-full! cursor-grab active:cursor-grabbing'>
              <div className='relative' style={{ width, height }}>
                <svg className='absolute inset-0 overflow-visible' width={width} height={height}>
                  <defs>
                    {[
                      ['tunnel-arrow-outbound', OUTBOUND_COLOR],
                      ['tunnel-arrow-inbound', INBOUND_COLOR],
                    ].map(([id, color]) => (
                      <marker
                        key={id}
                        id={id}
                        viewBox='0 0 10 10'
                        refX='9'
                        refY='5'
                        markerWidth='6'
                        markerHeight='6'
                        orient='auto-start-reverse'
                      >
                        <path d='M 0 0 L 10 5 L 0 10 z' fill={color} />
                      </marker>
                    ))}
                  </defs>

                  {centre &&
                    placed
                      .filter((node) => node.edges)
                      .flatMap((node) => {
                        const centreRight = centre.x + NODE_WIDTH;
                        const centreMid = centre.y + centre.height / 2;
                        const peerMid = node.y + node.height / 2;

                        return [
                          <Edge
                            key={`${node.key}-outbound`}
                            edge={node.edges!.outbound}
                            from={{ x: centreRight + EDGE_GAP, y: centreMid - EDGE_OFFSET }}
                            to={{ x: node.x - EDGE_GAP, y: peerMid - EDGE_OFFSET }}
                            color={OUTBOUND_COLOR}
                            marker='tunnel-arrow-outbound'
                          />,
                          <Edge
                            key={`${node.key}-inbound`}
                            edge={node.edges!.inbound}
                            from={{ x: node.x - EDGE_GAP, y: peerMid + EDGE_OFFSET }}
                            to={{ x: centreRight + EDGE_GAP, y: centreMid + EDGE_OFFSET }}
                            color={INBOUND_COLOR}
                            marker='tunnel-arrow-inbound'
                          />,
                        ];
                      })}
                </svg>

                {placed.map((node) => (
                  <div key={node.key} className='absolute' style={{ left: node.x, top: node.y, width: NODE_WIDTH }}>
                    {node.render(measure(node.key))}
                  </div>
                ))}
              </div>
            </TransformComponent>
          </TransformWrapper>
        </div>
      )}
    </ContextMenu>
  );
}
