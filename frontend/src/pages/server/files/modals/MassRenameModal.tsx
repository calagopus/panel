import {
  faArrowLeftLong,
  faArrowRight,
  faFont,
  faHashtag,
  faMagnifyingGlass,
  faTag,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ModalProps } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';
import renameFiles from '@/api/server/files/renameFiles.ts';
import Button from '@/elements/Button.tsx';
import Code from '@/elements/Code.tsx';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import Group from '@/elements/Group.tsx';
import Checkbox from '@/elements/input/Checkbox.tsx';
import NumberInput from '@/elements/input/NumberInput.tsx';
import Select from '@/elements/input/Select.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import FormModal from '@/elements/modals/FormModal.tsx';
import { ModalFooter } from '@/elements/modals/Modal.tsx';
import SegmentedControl from '@/elements/SegmentedControl.tsx';
import Stack from '@/elements/Stack.tsx';
import Table, { TableData, TableRow } from '@/elements/Table.tsx';
import Text from '@/elements/Text.tsx';
import Tooltip from '@/elements/Tooltip.tsx';
import { buildRenamePreview, MassRenameOptions, RenameCase, RenameScope, RenameStatus } from '@/lib/massRename.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

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
  const { t, tReact, tItem } = useTranslations();
  const { addToast } = useToast();
  const server = useServerStore((state) => state.server);
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

      addToast(t('pages.server.files.toast.filesRenamed', { files: tItem('file', renamed) }), [
        {
          name: t('common.button.undo', {}),
          icon: faArrowLeftLong,
          onClick: () =>
            renameFiles({
              uuid: server.uuid,
              root: directory,
              files: renames.map((rename) => ({ from: rename.to, to: rename.from })),
            })
              .then(({ renamed: undone }) => {
                if (undone < 1) {
                  addToast(t('pages.server.files.toast.renameCouldNotBeUndone', {}), 'error');
                  return;
                }

                addToast(t('pages.server.files.toast.renameUndone', {}), 'success');
                invalidateFilemanager();
              })
              .catch((err) => {
                addToast(err instanceof Error ? err.message : String(err), 'error');
              }),
        },
      ]);
      invalidateFilemanager();
      doSelectFiles([]);
      props.onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setLoading(false);
    }
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
            label={t('pages.server.files.modal.massRename.replace', {})}
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
          <CollapsibleSection
            icon={<FontAwesomeIcon icon={faMagnifyingGlass} />}
            title={t('pages.server.files.modal.massRename.section.matchOptions', {})}
            enabled={expanded === 'match'}
            onToggle={() => toggleSection('match')}
          >
            <Stack gap='sm'>
              <Switch
                label={t('pages.server.files.modal.massRename.option.regex', {})}
                description={t('pages.server.files.modal.massRename.option.regexDescription', {})}
                checked={options.regex}
                onChange={(e) => setOptions((o) => ({ ...o, regex: e.target.checked }))}
              />
              <Group grow>
                <Switch
                  label={t('pages.server.files.modal.massRename.option.caseSensitive', {})}
                  checked={options.caseSensitive}
                  onChange={(e) => setOptions((o) => ({ ...o, caseSensitive: e.target.checked }))}
                />
                <Switch
                  label={t('pages.server.files.modal.massRename.option.allOccurrences', {})}
                  checked={options.allOccurrences}
                  onChange={(e) => setOptions((o) => ({ ...o, allOccurrences: e.target.checked }))}
                />
              </Group>
            </Stack>
          </CollapsibleSection>

          <CollapsibleSection
            icon={<FontAwesomeIcon icon={faTag} />}
            title={t('pages.server.files.modal.massRename.section.affixes', {})}
            enabled={expanded === 'affixes'}
            onToggle={() => toggleSection('affixes')}
          >
            <Stack gap='sm'>
              <Group grow align='start'>
                <TextInput
                  label={t('pages.server.files.modal.massRename.affix.prefix', {})}
                  value={options.prefix}
                  onChange={(e) => setOptions((o) => ({ ...o, prefix: e.target.value }))}
                />
                <TextInput
                  label={t('pages.server.files.modal.massRename.affix.suffix', {})}
                  value={options.suffix}
                  onChange={(e) => setOptions((o) => ({ ...o, suffix: e.target.value }))}
                />
              </Group>
              <Text size='xs' c='dimmed'>
                {tReact('pages.server.files.modal.massRename.affix.help', { token: <Code>{'{n}'}</Code> })}
              </Text>
            </Stack>
          </CollapsibleSection>

          <CollapsibleSection
            icon={<FontAwesomeIcon icon={faFont} />}
            title={t('pages.server.files.modal.massRename.section.caseConversion', {})}
            enabled={expanded === 'case'}
            onToggle={() => toggleSection('case')}
          >
            <Select
              label={t('pages.server.files.modal.massRename.case.label', {})}
              value={options.caseTransform}
              onChange={(value) => setOptions((o) => ({ ...o, caseTransform: (value ?? 'none') as RenameCase }))}
              data={[
                { value: 'none', label: t('pages.server.files.modal.massRename.case.none', {}) },
                { value: 'lower', label: t('pages.server.files.modal.massRename.case.lower', {}) },
                { value: 'upper', label: t('pages.server.files.modal.massRename.case.upper', {}) },
                { value: 'title', label: t('pages.server.files.modal.massRename.case.title', {}) },
                { value: 'capitalize', label: t('pages.server.files.modal.massRename.case.capitalize', {}) },
              ]}
            />
          </CollapsibleSection>

          <CollapsibleSection
            icon={<FontAwesomeIcon icon={faHashtag} />}
            title={t('pages.server.files.modal.massRename.section.numbering', {})}
            enabled={expanded === 'number'}
            onToggle={() => toggleSection('number')}
          >
            <Stack gap='sm'>
              <Switch
                label={t('pages.server.files.modal.massRename.numbering.enable', {})}
                checked={options.numbering.enabled}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, numbering: { ...o.numbering, enabled: e.target.checked } }))
                }
              />
              <Text size='xs' c='dimmed'>
                {tReact('pages.server.files.modal.massRename.numbering.help', { token: <Code>{'{n}'}</Code> })}
              </Text>
              <Group grow>
                <NumberInput
                  label={t('pages.server.files.modal.massRename.numbering.start', {})}
                  value={options.numbering.start}
                  onChange={(value) =>
                    setOptions((o) => ({ ...o, numbering: { ...o.numbering, start: Number(value) || 0 } }))
                  }
                />
                <NumberInput
                  label={t('pages.server.files.modal.massRename.numbering.step', {})}
                  value={options.numbering.step}
                  onChange={(value) =>
                    setOptions((o) => ({ ...o, numbering: { ...o.numbering, step: Number(value) || 0 } }))
                  }
                />
                <NumberInput
                  label={t('pages.server.files.modal.massRename.numbering.padding', {})}
                  min={1}
                  max={10}
                  value={options.numbering.padding}
                  onChange={(value) =>
                    setOptions((o) => ({
                      ...o,
                      numbering: { ...o.numbering, padding: Math.max(1, Number(value) || 1) },
                    }))
                  }
                />
              </Group>
            </Stack>
          </CollapsibleSection>
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

          <div className='max-h-72 overflow-y-auto'>
            <Table
              allowSelect={false}
              columns={[
                { name: '' },
                { name: t('pages.server.files.modal.massRename.preview.original', {}) },
                { name: '' },
                { name: t('pages.server.files.modal.massRename.preview.newName', {}) },
                { name: '' },
              ]}
            >
              {files.length === 0 ? (
                <TableRow>
                  <TableData colSpan={5}>
                    <Text size='sm' c='dimmed' className='text-center'>
                      {t('pages.server.files.modal.massRename.preview.empty', {})}
                    </Text>
                  </TableData>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const blocking = blockingStatuses.includes(row.status);

                  return (
                    <TableRow key={row.name} className={blocking ? 'bg-(--mantine-color-red-light)' : undefined}>
                      <TableData className='w-px'>
                        <Checkbox
                          checked={row.included}
                          disabled={row.status === 'unchanged' || blocking}
                          onChange={() => toggleExcluded(row.name)}
                        />
                      </TableData>
                      <TableData className='max-w-xs truncate text-(--mantine-color-dimmed)'>{row.name}</TableData>
                      <TableData className='w-px'>
                        <FontAwesomeIcon icon={faArrowRight} className='w-3 h-3 text-(--mantine-color-dimmed)' />
                      </TableData>
                      <TableData
                        className={`max-w-xs truncate ${row.status === 'unchanged' ? 'text-(--mantine-color-dimmed)' : ''}`}
                      >
                        {row.status === 'invalidRegex' ? row.name : row.newName}
                      </TableData>
                      <TableData className='w-px whitespace-nowrap text-right'>
                        {blocking && statusLabel[row.status] ? (
                          <Tooltip label={statusLabel[row.status]!}>
                            <FontAwesomeIcon
                              icon={faTriangleExclamation}
                              className='w-3.5 h-3.5 text-(--mantine-color-red-text)'
                            />
                          </Tooltip>
                        ) : row.status === 'unchanged' ? (
                          <Text size='xs' c='dimmed'>
                            {statusLabel.unchanged}
                          </Text>
                        ) : null}
                      </TableData>
                    </TableRow>
                  );
                })
              )}
            </Table>
          </div>

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
