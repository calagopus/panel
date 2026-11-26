import { faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Treemap } from '@mantine/charts';
import { Anchor, ModalProps } from '@mantine/core';
import { join } from 'pathe';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getDirectorySizes from '@/api/server/files/getDirectorySizes.ts';
import Button from '@/elements/buttons/Button.tsx';
import Breadcrumbs from '@/elements/data-display/Breadcrumbs.tsx';
import EmptyState from '@/elements/feedback/EmptyState.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Text from '@/elements/typography/Text.tsx';
import { bytesToString } from '@/lib/format/size.ts';
import { serverDirectorySizesSchema } from '@/lib/schemas/server/files.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

import '@mantine/charts/styles.css';

const TREEMAP_COLORS = [
  'blue.8',
  'teal.8',
  'violet.8',
  'orange.8',
  'red.8',
  'cyan.8',
  'green.8',
  'yellow.8',
  'pink.8',
  'indigo.8',
];

function mantineColorToCss(color: string): string {
  const [name, shade] = color.split('.');
  return shade ? `var(--mantine-color-${name}-${shade})` : `var(--mantine-color-${name}-6)`;
}

function TreemapCell({
  x,
  y,
  width,
  height,
  name,
  color,
  depth,
  size,
  share,
  folder,
  onCellClick,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  color?: string;
  depth?: number;
  size?: string;
  share?: string;
  folder?: boolean;
  onCellClick?: () => void;
}) {
  if (depth === 0 || x === undefined || y === undefined || width === undefined || height === undefined) return null;

  const showLabel = width > 48 && height > 22;
  const showDetails = width > 72 && height > 44;

  return (
    <g onClick={onCellClick} className={folder ? 'cursor-pointer [&:hover>rect]:brightness-125' : undefined}>
      <title>{`${name} · ${size} · ${share}`}</title>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill: mantineColorToCss(color ?? 'blue.8'), transition: 'filter 100ms' }}
        stroke='var(--mantine-color-body)'
        strokeWidth={2}
      />
      {showLabel && (
        <foreignObject x={x} y={y} width={width} height={height} style={{ pointerEvents: 'none' }}>
          <div className='flex h-full w-full flex-col justify-between overflow-hidden p-2 text-white select-none'>
            <span className='truncate text-xs font-medium'>
              {name}
              {folder && '/'}
            </span>
            {showDetails && (
              <span className='truncate text-xs tabular-nums opacity-80'>
                {size} · {share}
              </span>
            )}
          </div>
        </foreignObject>
      )}
    </g>
  );
}

type DirectorySizes = z.infer<typeof serverDirectorySizesSchema>;

export default function LargestDirectoriesModal({ onClose, ...props }: ModalProps) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const browsingDirectory = useFileManager((state) => state.browsingDirectory);
  const [, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [trail, setTrail] = useState<DirectorySizes[]>([]);

  const load = (path: string[], node?: DirectorySizes) => {
    setLoading(true);
    getDirectorySizes(server.uuid, join(browsingDirectory, ...path))
      .then((sizes) =>
        setTrail((current) => [...current.slice(0, path.length), { ...sizes, name: node?.name ?? sizes.name }]),
      )
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setTrail([]);
    if (props.opened) {
      load([]);
    }
  }, [props.opened, server.uuid, browsingDirectory]);

  const path = trail.slice(1).map((node) => node.name);
  const current = trail.at(-1);

  const handleNavigate = () => {
    onClose();
    setSearchParams({ directory: join(browsingDirectory, ...path) });
  };

  const zoom = (node: DirectorySizes) => {
    if (node.truncated) {
      load([...path, node.name], node);
    } else {
      setTrail([...trail, node]);
    }
  };

  const total = current?.size ?? 0;
  const share = (size: number) => `${total > 0 ? ((size / total) * 100).toFixed(1) : '0'}%`;
  const bucket = (name: string, value: number, color: string) => ({
    name,
    value,
    color,
    size: bytesToString(value),
    share: share(value),
    folder: false,
  });

  const treemapData = current
    ? [
        ...current.children.map((node, i) => ({
          name: node.name,
          value: node.size,
          color: TREEMAP_COLORS[i % TREEMAP_COLORS.length],
          size: bytesToString(node.size),
          share: share(node.size),
          folder: true,
          onCellClick: () => zoom(node),
        })),
        ...(current.filesSize > 0
          ? [bucket(t('pages.server.files.modal.largestDirectories.files', {}), current.filesSize, 'gray.7')]
          : []),
        ...(current.otherSize > 0
          ? [
              bucket(
                t('pages.server.files.modal.largestDirectories.smallerFolders', {
                  items: tItem('directory', current.otherCount),
                }),
                current.otherSize,
                'gray.8',
              ),
            ]
          : []),
        ...(current.inaccessibleSize > 0
          ? [
              bucket(
                t('pages.server.files.modal.largestDirectories.inaccessible', {}),
                current.inaccessibleSize,
                'dark.6',
              ),
            ]
          : []),
      ]
    : [];

  return (
    <Modal title={t('pages.server.files.modal.largestDirectories.title', {})} size='xl' onClose={onClose} {...props}>
      <Stack gap='md'>
        {!current ? (
          loading ? (
            <Spinner.Centered />
          ) : (
            <Text c='dimmed' ta='center' py='xl'>
              {t('pages.server.files.modal.largestDirectories.empty', {})}
            </Text>
          )
        ) : (
          <>
            <div className='flex items-center justify-between gap-2'>
              <Breadcrumbs separatorMargin='xs' className='min-w-0 flex-wrap'>
                {trail.map((node, i) =>
                  i === trail.length - 1 ? (
                    <span key={i} className='text-sm'>
                      {i === 0 && browsingDirectory === '/' ? <FontAwesomeIcon icon={faFolderOpen} /> : node.name}
                    </span>
                  ) : (
                    <Anchor
                      component='button'
                      type='button'
                      key={i}
                      size='sm'
                      onClick={() => setTrail(trail.slice(0, i + 1))}
                    >
                      {i === 0 && browsingDirectory === '/' ? <FontAwesomeIcon icon={faFolderOpen} /> : node.name}
                    </Anchor>
                  ),
                )}
              </Breadcrumbs>
              <div className='flex items-center gap-2'>
                {loading && <Spinner size={16} />}
                {trail.length > 1 && current.children.length > 0 && (
                  <Button variant='default' size='xs' onClick={handleNavigate}>
                    {t('pages.server.files.modal.largestDirectories.openFolder', {})}
                  </Button>
                )}
              </div>
            </div>
            {trail.length > 1 && current.children.length === 0 ? (
              <div className='flex h-130 flex-col justify-center'>
                <EmptyState
                  icon={faFolderOpen}
                  title={current.name}
                  description={t('pages.server.files.modal.largestDirectories.noSubdirectories', {
                    size: bytesToString(current.size),
                  })}
                >
                  <Button onClick={handleNavigate}>
                    {t('pages.server.files.modal.largestDirectories.openFolder', {})}
                  </Button>
                </EmptyState>
              </div>
            ) : (
              <Treemap
                data={treemapData}
                height={520}
                withTooltip={false}
                treemapProps={{ content: <TreemapCell />, isAnimationActive: false }}
              />
            )}
          </>
        )}
      </Stack>

      <ModalFooter>
        <Button variant='default' onClick={onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
