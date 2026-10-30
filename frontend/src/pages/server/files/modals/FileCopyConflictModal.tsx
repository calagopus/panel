import { ModalProps } from '@mantine/core';
import { basename, dirname, join } from 'pathe';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
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
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import FileRowIcon from '@/pages/server/files/list/FileRowIcon.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

export interface FileConflict {
  from: string;
  to: string;
  server?: { uuid: string; name: string };
  source: z.infer<typeof serverDirectoryEntrySchema>;
  destination: z.infer<typeof serverDirectoryEntrySchema>;
}

export interface ConflictResolutions {
  overwrite: { from: string; to: string; server?: string }[];
  rename: { from: string; to: string; server?: string }[];
}

type Resolution = 'skip' | 'overwrite' | 'rename';

type Props = ModalProps & {
  conflicts: FileConflict[];
  loading: boolean;
  onResolve: (resolutions: ConflictResolutions) => void;
};

function conflictKey(conflict: FileConflict): string {
  return conflict.server ? `${conflict.server.uuid}:${conflict.to}` : conflict.to;
}

function FileMeta({ entry, label }: { entry: z.infer<typeof serverDirectoryEntrySchema>; label: string }) {
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
        <Text size='sm'>{bytesToString(entry.size)}</Text>
      </span>
      <span className='flex flex-row items-center justify-between gap-2'>
        <Text size='sm' c='dimmed'>
          {t('pages.server.files.modal.details.lastModifiedAt', {})}
        </Text>
        <Text size='sm'>
          <FormattedTimestamp timestamp={entry.modified ?? 0} />
        </Text>
      </span>
    </div>
  );
}

export default function FileCopyConflictModal({ conflicts, loading, onResolve, ...props }: Props) {
  const { t, tItem } = useTranslations();
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [renames, setRenames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (props.opened) {
      setResolutions(Object.fromEntries(conflicts.map((c) => [conflictKey(c), 'skip' as Resolution])));
      setRenames(Object.fromEntries(conflicts.map((c) => [conflictKey(c), generateCopyName(basename(c.to))])));
    }
  }, [props.opened, conflicts]);

  const setAll = (resolution: Resolution) => {
    setResolutions(Object.fromEntries(conflicts.map((c) => [conflictKey(c), resolution])));
  };

  const invalidRename = useMemo(
    () =>
      conflicts.some((c) => {
        const key = conflictKey(c);
        return resolutions[key] === 'rename' && (!renames[key]?.trim() || renames[key].includes('/'));
      }),
    [conflicts, resolutions, renames],
  );

  const actionCount = useMemo(
    () =>
      conflicts.filter((c) => resolutions[conflictKey(c)] === 'overwrite' || resolutions[conflictKey(c)] === 'rename')
        .length,
    [conflicts, resolutions],
  );

  const handleApply = () => {
    const result: ConflictResolutions = { overwrite: [], rename: [] };

    for (const conflict of conflicts) {
      const key = conflictKey(conflict);
      const resolution = resolutions[key];
      if (resolution === 'overwrite') {
        result.overwrite.push({ from: conflict.from, to: conflict.to, server: conflict.server?.uuid });
      } else if (resolution === 'rename') {
        const name = renames[key].trim();
        result.rename.push({
          from: conflict.from,
          to: name.startsWith('/') ? name : join(dirname(conflict.to), name),
          server: conflict.server?.uuid,
        });
      }
    }

    onResolve(result);
  };

  return (
    <Modal title={t('pages.server.files.modal.copyConflict.title', {})} size='lg' {...props}>
      <Stack gap='sm'>
        <Group justify='space-between'>
          <Text size='sm' c='dimmed'>
            {t('pages.server.files.modal.copyConflict.description', {
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
              <Card key={conflictKey(conflict)} className='p-3'>
                <Stack gap='xs'>
                  {conflict.server && (
                    <Text size='xs' fw={600} c='dimmed' className='break-all'>
                      {conflict.server.name}
                    </Text>
                  )}
                  <Text fw={500} className='break-all'>
                    <FileRowIcon className='mr-2' file={conflict.source} />
                    {basename(conflict.to)}
                  </Text>
                  <div className='flex flex-col md:flex-row gap-3'>
                    <FileMeta entry={conflict.source} label={t('pages.server.files.modal.copyConflict.source', {})} />
                    <FileMeta
                      entry={conflict.destination}
                      label={t('pages.server.files.modal.copyConflict.destination', {})}
                    />
                  </div>
                  <SegmentedControl
                    fullWidth
                    size='xs'
                    value={resolutions[conflictKey(conflict)] ?? 'skip'}
                    onChange={(value) =>
                      setResolutions((prev) => ({ ...prev, [conflictKey(conflict)]: value as Resolution }))
                    }
                    data={[
                      { value: 'skip', label: t('pages.server.files.modal.copyConflict.skip', {}) },
                      { value: 'overwrite', label: t('pages.server.files.modal.copyConflict.overwrite', {}) },
                      { value: 'rename', label: t('pages.server.files.modal.copyConflict.rename', {}) },
                    ]}
                  />
                  {resolutions[conflictKey(conflict)] === 'rename' && (
                    <TextInput
                      size='xs'
                      label={t('common.form.newName', {})}
                      value={renames[conflictKey(conflict)] ?? ''}
                      onChange={(e) => setRenames((prev) => ({ ...prev, [conflictKey(conflict)]: e.target.value }))}
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
          {t('pages.server.files.modal.copyConflict.confirm', { files: tItem('file', actionCount) })}
        </Button>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.close', {})}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
