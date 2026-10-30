import { faFile, faFolder } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { basename, dirname, resolve } from 'pathe';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import restoreTrashEntries from '@/api/server/files/trash/restoreTrashEntries.ts';
import Button from '@/elements/buttons/Button.tsx';
import Card from '@/elements/data-display/Card.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Group from '@/elements/layout/Group.tsx';
import SegmentedControl from '@/elements/layout/SegmentedControl.tsx';
import Stack from '@/elements/layout/Stack.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import FormattedTimestamp from '@/elements/time/FormattedTimestamp.tsx';
import Text from '@/elements/typography/Text.tsx';
import { generateCopyName } from '@/lib/files/files.ts';
import { bytesToString } from '@/lib/format/size.ts';
import { serverDirectoryEntrySchema, serverTrashEntrySchema } from '@/lib/schemas/server/files.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { useRestoredToast } from './useRestoredToast.ts';

export interface TrashRestoreTarget {
  entry: z.infer<typeof serverTrashEntrySchema>;
  path?: string;
}

export interface TrashRestoreConflict {
  entry: z.infer<typeof serverTrashEntrySchema>;
  target: string;
  destination: z.infer<typeof serverDirectoryEntrySchema>;
}

type Resolution = 'skip' | 'overwrite' | 'rename';

type Props = ModalProps & {
  conflicts: TrashRestoreConflict[];
  onResolved: (remaining: TrashRestoreConflict[]) => void;
  onUndone: () => void;
};

export function collectRestoreConflicts(
  targets: TrashRestoreTarget[],
  conflicts: Awaited<ReturnType<typeof restoreTrashEntries>>['conflicts'],
): TrashRestoreConflict[] {
  return conflicts.flatMap(({ uuid, destination }): TrashRestoreConflict[] => {
    const match = targets.find((target) => target.entry.uuid === uuid);
    if (!match) return [];

    return [{ entry: match.entry, target: match.path ?? match.entry.path, destination }];
  });
}

function EntryMeta({
  label,
  size,
  timestampLabel,
  timestamp,
}: {
  label: string;
  size: number;
  timestampLabel: string;
  timestamp: ReactNode;
}) {
  const { t } = useTranslations();

  return (
    <div className='flex flex-col grow min-w-0'>
      <Text size='xs' fw={600} c='dimmed' tt='uppercase'>
        {label}
      </Text>
      <span className='flex flex-row items-center justify-between gap-2'>
        <Text size='sm' c='dimmed'>
          {t('pages.server.files.modal.details.logicalSize', {})}
        </Text>
        <Text size='sm'>{bytesToString(size)}</Text>
      </span>
      <span className='flex flex-row items-center justify-between gap-2'>
        <Text size='sm' c='dimmed'>
          {timestampLabel}
        </Text>
        <Text size='sm'>{timestamp}</Text>
      </span>
    </div>
  );
}

export default function TrashRestoreConflictModal({ conflicts, onResolved, onUndone, ...props }: Props) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const addRestoredToast = useRestoredToast(onUndone);

  const [loading, setLoading] = useState(false);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [renames, setRenames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (props.opened) {
      setResolutions(Object.fromEntries(conflicts.map((c) => [c.entry.uuid, 'skip' as Resolution])));
      setRenames(Object.fromEntries(conflicts.map((c) => [c.entry.uuid, generateCopyName(basename(c.target))])));
    }
  }, [props.opened, conflicts]);

  const setAll = (resolution: Resolution) => {
    setResolutions(Object.fromEntries(conflicts.map((c) => [c.entry.uuid, resolution])));
  };

  const invalidRename = useMemo(
    () =>
      conflicts.some((c) => {
        const key = c.entry.uuid;
        return resolutions[key] === 'rename' && (!renames[key]?.trim() || renames[key].includes('/'));
      }),
    [conflicts, resolutions, renames],
  );

  const actionCount = useMemo(
    () =>
      conflicts.filter((c) => resolutions[c.entry.uuid] === 'overwrite' || resolutions[c.entry.uuid] === 'rename')
        .length,
    [conflicts, resolutions],
  );

  const handleApply = () => {
    const overwrite: TrashRestoreTarget[] = [];
    const rename: TrashRestoreTarget[] = [];

    for (const conflict of conflicts) {
      const resolution = resolutions[conflict.entry.uuid];
      if (resolution === 'overwrite') {
        overwrite.push({ entry: conflict.entry, path: conflict.target });
      } else if (resolution === 'rename') {
        rename.push({
          entry: conflict.entry,
          path: resolve('/', dirname(conflict.target), renames[conflict.entry.uuid].trim()),
        });
      }
    }

    const toRequest = (targets: TrashRestoreTarget[]) =>
      targets.map((target) => ({ uuid: target.entry.uuid, path: target.path }));

    setLoading(true);

    Promise.all([
      overwrite.length > 0
        ? restoreTrashEntries({ uuid: server.uuid, entries: toRequest(overwrite), overwrite: true })
        : Promise.resolve(null),
      rename.length > 0
        ? restoreTrashEntries({ uuid: server.uuid, entries: toRequest(rename) })
        : Promise.resolve(null),
    ])
      .then(([overwritten, renamed]) => {
        const restored = [...(overwritten?.restored ?? []), ...(renamed?.restored ?? [])];
        addRestoredToast(restored, !overwritten);

        onResolved(collectRestoreConflicts(rename, renamed?.conflicts ?? []));
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.files.trash.modal.restoreConflict.title', {})} size='lg' {...props}>
      <Stack gap='sm'>
        <Group justify='space-between'>
          <Text size='sm' c='dimmed'>
            {t('pages.server.files.trash.modal.restoreConflict.description', {
              files: tItem('file', conflicts.length),
            })}
          </Text>
          <Group gap='xs'>
            <Button size='compact-xs' variant='default' onClick={() => setAll('skip')}>
              {t('pages.server.files.modal.copyConflict.skipAll', {})}
            </Button>
            <Button size='compact-xs' variant='default' onClick={() => setAll('overwrite')}>
              {t('pages.server.files.modal.copyConflict.overwriteAll', {})}
            </Button>
          </Group>
        </Group>

        <div className='max-h-[50vh] min-h-0 overflow-y-auto'>
          <Stack gap='xs'>
            {conflicts.map((conflict) => (
              <Card key={conflict.entry.uuid} className='p-3'>
                <Stack gap='xs'>
                  <Text fw={500} className='break-all'>
                    <FontAwesomeIcon
                      icon={conflict.entry.directory ? faFolder : faFile}
                      className='mr-2 text-(--mantine-color-dimmed)'
                    />
                    {basename(conflict.target)}
                  </Text>
                  <div className='flex flex-col md:flex-row gap-3'>
                    <EntryMeta
                      label={t('pages.server.files.trash.title', {})}
                      size={conflict.entry.size}
                      timestampLabel={t('pages.server.files.trash.table.columns.deletedAt', {})}
                      timestamp={<FormattedTimestamp timestamp={conflict.entry.deletedAt} />}
                    />
                    <EntryMeta
                      label={t('pages.server.files.modal.copyConflict.destination', {})}
                      size={conflict.destination.size}
                      timestampLabel={t('pages.server.files.modal.details.lastModifiedAt', {})}
                      timestamp={<FormattedTimestamp timestamp={conflict.destination.modified ?? 0} />}
                    />
                  </div>
                  <SegmentedControl
                    fullWidth
                    size='xs'
                    value={resolutions[conflict.entry.uuid] ?? 'skip'}
                    onChange={(value) =>
                      setResolutions((prev) => ({ ...prev, [conflict.entry.uuid]: value as Resolution }))
                    }
                    data={[
                      { value: 'skip', label: t('pages.server.files.modal.copyConflict.skip', {}) },
                      { value: 'overwrite', label: t('pages.server.files.modal.copyConflict.overwrite', {}) },
                      { value: 'rename', label: t('pages.server.files.modal.copyConflict.rename', {}) },
                    ]}
                  />
                  {resolutions[conflict.entry.uuid] === 'rename' && (
                    <TextInput
                      size='xs'
                      label={t('common.form.newName', {})}
                      value={renames[conflict.entry.uuid] ?? ''}
                      onChange={(e) => setRenames((prev) => ({ ...prev, [conflict.entry.uuid]: e.target.value }))}
                    />
                  )}
                </Stack>
              </Card>
            ))}
          </Stack>
        </div>
      </Stack>

      <ModalFooter>
        <Button loading={loading} disabled={actionCount === 0 || invalidRename} onClick={handleApply}>
          {t('pages.server.files.trash.modal.restoreConflict.confirm', { files: tItem('file', actionCount) })}
        </Button>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
