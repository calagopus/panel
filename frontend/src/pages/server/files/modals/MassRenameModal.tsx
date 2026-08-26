import { ModalProps } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';
import renameFiles from '@/api/server/files/renameFiles.ts';
import Button from '@/elements/Button.tsx';
import Group from '@/elements/Group.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import SegmentedControl from '@/elements/SegmentedControl.tsx';
import Stack from '@/elements/Stack.tsx';
import Text from '@/elements/Text.tsx';
import { buildRenamePreview, MassRenameOptions, RenameScope, RenameStatus } from '@/lib/files/massRename.ts';
import { createUndoAction } from '@/lib/files/undoableFileMutation.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { useUndoableToast } from '@/plugins/useUndoableToast.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';
import { fileManagerUndoScope } from '@/stores/undoHistory.ts';
import MassRenameAffixSection from './MassRenameAffixSection.tsx';
import MassRenameCaseSection from './MassRenameCaseSection.tsx';
import MassRenameMatchSection from './MassRenameMatchSection.tsx';
import MassRenameNumberSection from './MassRenameNumberSection.tsx';
import MassRenamePreviewTable from './MassRenamePreviewTable.tsx';

type Props = ModalProps & {
  files: z.infer<typeof serverDirectoryEntrySchema>[];
};

type Section = 'match' | 'affixes' | 'case' | 'number';

const defaultOptions: MassRenameOptions = {
  find: '',
  replace: '',
  regex: false,
  caseSensitive: false,
  allOccurrences: true,
  scope: 'name',
  prefix: '',
  suffix: '',
  caseTransform: 'none',
  numbering: {
    enabled: false,
    start: 1,
    step: 1,
    padding: 1,
  },
};

const blockingStatuses: RenameStatus[] = ['invalid', 'invalidRegex', 'conflict', 'duplicate'];

export default function MassRenameModal({ files, ...props }: Props) {
  const { t, tItem } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
  const addUndoableToast = useUndoableToast(fileManagerUndoScope(server.uuid));
  const { browsingDirectory, browsingEntries, invalidateFilemanager, doSelectFiles } = useFileManager(
    useShallow((state) => ({
      browsingDirectory: state.browsingDirectory,
      browsingEntries: state.browsingEntries,
      invalidateFilemanager: state.invalidateFilemanager,
      doSelectFiles: state.doSelectFiles,
    })),
  );

  const [options, setOptions] = useState<MassRenameOptions>(defaultOptions);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Section | null>('match');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.opened) {
      setOptions(defaultOptions);
      setExcluded(new Set());
      setExpanded('match');
      setLoading(false);
    }
  }, [props.opened]);

  const existingNames = useMemo(() => new Set(browsingEntries.data.map((entry) => entry.name)), [browsingEntries.data]);

  const rows = useMemo(
    () => buildRenamePreview(files, options, existingNames, excluded),
    [files, options, existingNames, excluded],
  );

  const changedRows = rows.filter((row) => row.status !== 'unchanged');
  const includedRows = rows.filter((row) => row.included);
  const hasBlocking = rows.some((row) => !excluded.has(row.name) && blockingStatuses.includes(row.status));
  const canSubmit = includedRows.length > 0 && !hasBlocking;

  const toggleSection = (section: Section) => setExpanded((prev) => (prev === section ? null : section));

  const toggleExcluded = (name: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    try {
      const directory = browsingDirectory;
      const renames = includedRows.map((row) => ({ from: row.name, to: row.newName }));

      const { renamed } = await renameFiles({
        uuid: server.uuid,
        root: directory,
        files: renames,
      });

      if (renamed < 1) {
        addToast(t('pages.server.files.toast.fileCouldNotBeRenamed', {}), 'error');
        return;
      }

      addUndoableToast(
        t('pages.server.files.toast.filesRenamed', { files: tItem('file', renamed) }),
        createUndoAction(
          () =>
            renameFiles({
              uuid: server.uuid,
              root: directory,
              files: renames.map((rename) => ({ from: rename.to, to: rename.from })),
            }),
          (result) => result.renamed,
          {
            addToast,
            invalidateFilemanager,
            cannotUndoMessage: t('pages.server.files.toast.renameCouldNotBeUndone', {}),
            undoneMessage: t('pages.server.files.toast.renameUndone', {}),
            onError: (err) => addToast(err instanceof Error ? err.message : String(err), 'error'),
          },
        ),
      );
      invalidateFilemanager();
      doSelectFiles([]);
      props.onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), 'error');
    }
    setLoading(false);
  };

  const statusLabel: Partial<Record<RenameStatus, string>> = {
    unchanged: t('pages.server.files.modal.massRename.preview.unchanged', {}),
    conflict: t('pages.server.files.modal.massRename.preview.conflict', {}),
    duplicate: t('pages.server.files.modal.massRename.preview.duplicate', {}),
    invalid: t('pages.server.files.modal.massRename.preview.invalid', {}),
    invalidRegex: t('pages.server.files.modal.massRename.preview.invalidRegex', {}),
  };

  return (
    <FormModal
      title={t('pages.server.files.modal.massRename.title', {})}
      loading={loading}
      size='xl'
      {...props}
      onSubmit={handleSubmit}
    >
      <Stack gap='md'>
        <Group grow align='start'>
          <TextInput
            label={t('pages.server.files.modal.massRename.find', {})}
            placeholder={t('pages.server.files.modal.massRename.findPlaceholder', {})}
            value={options.find}
            onChange={(e) => setOptions((o) => ({ ...o, find: e.target.value }))}
            data-autofocus
          />
          <TextInput
            label={t('common.form.replaceWith', {})}
            placeholder={t('pages.server.files.modal.massRename.replacePlaceholder', {})}
            value={options.replace}
            onChange={(e) => setOptions((o) => ({ ...o, replace: e.target.value }))}
          />
        </Group>

        <div>
          <Text size='sm' fw={500} mb={4}>
            {t('pages.server.files.modal.massRename.scope', {})}
          </Text>
          <SegmentedControl
            fullWidth
            value={options.scope}
            onChange={(value) => setOptions((o) => ({ ...o, scope: value as RenameScope }))}
            data={[
              { value: 'name', label: t('pages.server.files.modal.massRename.scopeName', {}) },
              { value: 'extension', label: t('pages.server.files.modal.massRename.scopeExtension', {}) },
              { value: 'full', label: t('pages.server.files.modal.massRename.scopeFull', {}) },
            ]}
          />
        </div>

        <Stack gap='xs'>
          <MassRenameMatchSection
            options={options}
            setOptions={setOptions}
            enabled={expanded === 'match'}
            onToggle={() => toggleSection('match')}
          />

          <MassRenameAffixSection
            options={options}
            setOptions={setOptions}
            enabled={expanded === 'affixes'}
            onToggle={() => toggleSection('affixes')}
          />

          <MassRenameCaseSection
            options={options}
            setOptions={setOptions}
            enabled={expanded === 'case'}
            onToggle={() => toggleSection('case')}
          />

          <MassRenameNumberSection
            options={options}
            setOptions={setOptions}
            enabled={expanded === 'number'}
            onToggle={() => toggleSection('number')}
          />
        </Stack>

        <div>
          <Group justify='space-between' mb={4}>
            <Text size='sm' fw={500}>
              {t('pages.server.files.modal.massRename.preview.title', {})}
            </Text>
            <Text size='xs' c='dimmed'>
              {t('pages.server.files.modal.massRename.summary', {
                changed: includedRows.length,
                total: files.length,
              })}
            </Text>
          </Group>

          <MassRenamePreviewTable
            files={files}
            rows={rows}
            blockingStatuses={blockingStatuses}
            statusLabel={statusLabel}
            toggleExcluded={toggleExcluded}
          />

          {hasBlocking && changedRows.length > 0 && (
            <Text size='xs' c='red' mt={4}>
              {t('pages.server.files.modal.massRename.conflictWarning', {})}
            </Text>
          )}
        </div>
      </Stack>

      <ModalFooter>
        <Button type='submit' loading={loading} disabled={!canSubmit}>
          {t('pages.server.files.button.rename', {})}
        </Button>
        <Button variant='default' onClick={props.onClose}>
          {t('common.button.cancel', {})}
        </Button>
      </ModalFooter>
    </FormModal>
  );
}
