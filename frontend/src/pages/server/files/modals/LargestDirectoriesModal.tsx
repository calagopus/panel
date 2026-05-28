import { Treemap } from '@mantine/charts';
import { ModalProps, Stack, Text } from '@mantine/core';
import { join } from 'pathe';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import getLargestDirectories from '@/api/server/files/getLargestDirectories.ts';
import Button from '@/elements/Button.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import Spinner from '@/elements/Spinner.tsx';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { bytesToString } from '@/lib/size.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

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
  index,
  onCellClick,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  color?: string;
  depth?: number;
  index?: number;
  onCellClick?: () => void;
}) {
  if (depth === 0 || x === undefined || y === undefined || width === undefined || height === undefined) return null;

  const clipId = `ld-clip-${index}`;

  return (
    <g onClick={onCellClick} style={{ cursor: 'pointer' }}>
      <defs>
        <clipPath id={clipId}>
          <rect x={x + 4} y={y + 4} width={width - 8} height={height - 8} />
        </clipPath>
      </defs>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill: mantineColorToCss(color ?? 'blue.8') }}
        stroke='var(--mantine-color-dark-7)'
        strokeWidth={2}
      />
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor='middle'
        dominantBaseline='middle'
        clipPath={`url(#${clipId})`}
        fill='white'
        fontSize={12}
        fontWeight={500}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {name}
      </text>
    </g>
  );
}

export default function LargestDirectoriesModal({ opened, onClose }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { server } = useServerStore();
  const { browsingDirectory } = useFileManager();
  const [, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<z.infer<typeof serverDirectoryEntrySchema>[]>([]);

  useEffect(() => {
    if (!opened) {
      setEntries([]);
      return;
    }

    setLoading(true);
    getLargestDirectories(server.uuid, browsingDirectory)
      .then(setEntries)
      .catch((err) => addToast(httpErrorToHuman(err), 'error'))
      .finally(() => setLoading(false));
  }, [opened, server.uuid, browsingDirectory]);

  const handleNavigate = useCallback(
    (name: string) => {
      onClose();
      setSearchParams({ directory: join(browsingDirectory, name) });
    },
    [onClose, browsingDirectory, setSearchParams],
  );

  const treemapData = entries.map((entry, i) => ({
    name: entry.name,
    value: entry.size,
    color: TREEMAP_COLORS[i % TREEMAP_COLORS.length],
    onCellClick: () => handleNavigate(entry.name),
  }));

  return (
    <Modal
      title={t('pages.server.files.modal.largestDirectories.title', {})}
      onClose={onClose}
      opened={opened}
      size='xl'
    >
      <Stack gap='md'>
        {loading ? (
          <Spinner.Centered />
        ) : treemapData.length === 0 ? (
          <Text c='dimmed' ta='center' py='xl'>
            {t('pages.server.files.modal.largestDirectories.empty', {})}
          </Text>
        ) : (
          <Treemap
            data={treemapData}
            height={600}
            valueFormatter={(value) => bytesToString(value)}
            treemapProps={{ content: <TreemapCell /> }}
          />
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
