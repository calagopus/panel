import {
  faChevronDown,
  faFileAlt,
  faFolder,
  faHardDrive,
  faSearch,
  faSliders,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Box, Collapse, Flex, Group, ModalProps, Stack, Text, UnstyledButton } from '@mantine/core';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { startTransition, useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import searchFiles from '@/api/server/files/searchFiles.ts';
import Button from '@/elements/Button.tsx';
import CollapsibleSection from '@/elements/CollapsibleSection.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import { Modal, ModalFooter } from '@/elements/modals/Modal.tsx';
import { serverFilesSearchSchema } from '@/lib/schemas/server/files.ts';
import { useModalForm } from '@/plugins/useModalForm.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';

export default function FileSearchModal({ opened, onClose }: ModalProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { settings } = useGlobalStore();
  const { server } = useServerStore();
  const {
    browsingDirectory,
    browsingFastDirectory,
    setBrowsingEntries,
    setSearchInfo,
    doSelectFiles,
    clearActingFiles,
  } = useFileManager();

  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { form, onClose: handleClose } = useModalForm<z.infer<typeof serverFilesSearchSchema>>(
    {
      initialValues: {
        pathFilter: null,
        sizeFilter: null,
        contentFilter: null,
      },
      validateInputOnBlur: true,
      validate: zod4Resolver(serverFilesSearchSchema),
    },
    onClose,
  );

  useEffect(() => {
    if (
      form.values.contentFilter?.maxSearchSize &&
      form.values.contentFilter?.maxSearchSize > settings.server.maxFileManagerContentSearchSize
    ) {
      form.setFieldValue('contentFilter.maxSearchSize', settings.server.maxFileManagerContentSearchSize);
    }
  }, [form.values.contentFilter]);

  useEffect(() => {
    if (!opened) {
      setQuery('');
      setShowAdvanced(false);
      form.reset();
    }
  }, [opened]);

  const activeFiltersCount = [form.values.pathFilter, form.values.contentFilter, form.values.sizeFilter].filter(
    Boolean,
  ).length;

  useEffect(() => {
    if (activeFiltersCount > 0) {
      setShowAdvanced(true);
    }
  }, [activeFiltersCount]);

  const doSearch = () => {
    setLoading(true);

    const searchFilters = {
      ...form.values,
      pathFilter:
        form.values.pathFilter ?? (query ? { include: [`**/*${query}*`], exclude: [], caseInsensitive: true } : null),
    };

    searchFiles(server.uuid, { root: browsingDirectory, ...searchFilters })
      .then((entries) => {
        startTransition(() => {
          setBrowsingEntries({ total: entries.length, page: 1, perPage: entries.length, data: entries });
          setSearchInfo({ query, filters: searchFilters });
          doSelectFiles([]);
          clearActingFiles();
        });
        handleClose();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t('pages.server.files.modal.searchFiles.title', {})} onClose={handleClose} opened={opened} size='lg'>
      <form onSubmit={form.onSubmit(() => doSearch())}>
        <Stack gap='md'>
          <TextInput
            placeholder={t('pages.server.files.modal.searchFiles.placeholder', {})}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftSection={<FontAwesomeIcon icon={faSearch} style={{ color: 'var(--mantine-color-gray-5)' }} />}
            size='md'
            data-autofocus
          />

          <UnstyledButton onClick={() => setShowAdvanced(!showAdvanced)}>
            <Flex
              align='center'
              gap='sm'
              py='xs'
              style={{
                borderRadius: 6,
                background: showAdvanced ? 'var(--mantine-color-dark-6)' : 'transparent',
                border: `1px solid ${showAdvanced ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-dark-5)'}`,
                transition: 'all 0.15s ease',
                paddingLeft: '14px',
                paddingRight: '14px',
              }}
            >
              <Box
                style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 5,
                  background: activeFiltersCount > 0 ? 'var(--mantine-color-blue-9)' : 'var(--mantine-color-dark-5)',
                }}
              >
                <FontAwesomeIcon
                  icon={faSliders}
                  size='xs'
                  style={{
                    color: activeFiltersCount > 0 ? 'var(--mantine-color-blue-2)' : 'var(--mantine-color-gray-5)',
                  }}
                />
              </Box>
              <Text size='sm' c={showAdvanced ? 'gray.2' : 'gray.5'} fw={500}>
                {t('pages.server.files.modal.searchFiles.advancedFilters', {})}
              </Text>
              {activeFiltersCount > 0 && (
                <Box
                  style={{
                    background: 'var(--mantine-color-blue-9)',
                    borderRadius: 10,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--mantine-color-blue-2)',
                  }}
                >
                  {activeFiltersCount}
                </Box>
              )}
              <Box style={{ flex: 1 }} />
              <FontAwesomeIcon
                icon={faChevronDown}
                size='xs'
                style={{
                  color: 'var(--mantine-color-gray-6)',
                  transform: showAdvanced ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 0.15s ease',
                }}
              />
            </Flex>
          </UnstyledButton>

          <Collapse expanded={showAdvanced}>
            <Stack gap='xs'>
              <CollapsibleSection
                icon={<FontAwesomeIcon icon={faFolder} />}
                title={t('pages.server.files.modal.searchFiles.pathPatterns', {})}
                enabled={!!form.values.pathFilter}
                onToggle={(enabled) =>
                  form.setFieldValue('pathFilter', enabled ? { include: [], exclude: [], caseInsensitive: true } : null)
                }
              >
                <Stack gap='sm'>
                  <Group grow align='start'>
                    <TagsInput
                      label={t('pages.server.files.modal.searchFiles.include', {})}
                      placeholder='e.g., *.js, src/**'
                      value={form.values.pathFilter?.include ?? []}
                      onChange={(value) =>
                        form.setFieldValue('pathFilter', {
                          include: value,
                          exclude: form.values.pathFilter?.exclude ?? [],
                          caseInsensitive: form.values.pathFilter?.caseInsensitive ?? true,
                        })
                      }
                    />
                    <TagsInput
                      label={t('pages.server.files.modal.searchFiles.exclude', {})}
                      placeholder='e.g., node_modules/**'
                      value={form.values.pathFilter?.exclude ?? []}
                      onChange={(value) =>
                        form.setFieldValue('pathFilter', {
                          include: form.values.pathFilter?.include ?? [],
                          exclude: value,
                          caseInsensitive: form.values.pathFilter?.caseInsensitive ?? true,
                        })
                      }
                    />
                  </Group>
                  <Switch
                    label={t('pages.server.files.modal.searchFiles.caseInsensitive', {})}
                    checked={form.values.pathFilter?.caseInsensitive ?? true}
                    onChange={(e) =>
                      form.setFieldValue('pathFilter', {
                        include: form.values.pathFilter?.include ?? [],
                        exclude: form.values.pathFilter?.exclude ?? [],
                        caseInsensitive: e.target.checked,
                      })
                    }
                  />
                </Stack>
              </CollapsibleSection>

              {browsingFastDirectory && (
                <CollapsibleSection
                  icon={<FontAwesomeIcon icon={faFileAlt} />}
                  title={t('pages.server.files.modal.searchFiles.fileContent', {})}
                  enabled={!!form.values.contentFilter}
                  onToggle={(enabled) =>
                    form.setFieldValue(
                      'contentFilter',
                      enabled
                        ? {
                            query: '',
                            maxSearchSize: settings.server.maxFileManagerContentSearchSize,
                            includeUnmatched: false,
                            caseInsensitive: true,
                          }
                        : null,
                    )
                  }
                >
                  <Stack gap='sm'>
                    <Group grow align='start'>
                      <TextInput
                        label={t('pages.server.files.modal.searchFiles.searchText', {})}
                        placeholder='Text to find in files'
                        size='sm'
                        {...form.getInputProps('contentFilter.query')}
                      />
                      <SizeInput
                        label={t('pages.server.files.modal.searchFiles.maxFileSize', {})}
                        mode='b'
                        min={0}
                        value={form.values.contentFilter?.maxSearchSize ?? 0}
                        onChange={(value) => form.setFieldValue('contentFilter.maxSearchSize', value)}
                      />
                    </Group>
                    <Group grow>
                      <Switch
                        label={t('pages.server.files.modal.searchFiles.includeOversized', {})}
                        description={t('pages.server.files.modal.searchFiles.includeOversizedDescription', {})}
                        {...form.getInputProps('contentFilter.includeUnmatched', { type: 'checkbox' })}
                      />
                      <Switch
                        label={t('pages.server.files.modal.searchFiles.caseInsensitive', {})}
                        {...form.getInputProps('contentFilter.caseInsensitive', { type: 'checkbox' })}
                      />
                    </Group>
                  </Stack>
                </CollapsibleSection>
              )}

              <CollapsibleSection
                icon={<FontAwesomeIcon icon={faHardDrive} />}
                title={t('pages.server.files.modal.searchFiles.fileSize', {})}
                enabled={!!form.values.sizeFilter}
                onToggle={(enabled) =>
                  form.setFieldValue('sizeFilter', enabled ? { min: 0, max: 100 * 1024 * 1024 } : null)
                }
              >
                <Group grow>
                  <SizeInput
                    label={t('pages.server.files.modal.searchFiles.minimum', {})}
                    mode='b'
                    min={0}
                    value={form.values.sizeFilter?.min ?? 0}
                    onChange={(value) => form.setFieldValue('sizeFilter.min', value)}
                  />
                  <SizeInput
                    label={t('pages.server.files.modal.searchFiles.maximum', {})}
                    mode='b'
                    min={0}
                    value={form.values.sizeFilter?.max ?? 0}
                    onChange={(value) => form.setFieldValue('sizeFilter.max', value)}
                  />
                </Group>
              </CollapsibleSection>
            </Stack>
          </Collapse>
        </Stack>

        <ModalFooter>
          <Button type='submit' loading={loading}>
            {t('pages.server.files.button.search', {})}
          </Button>
          <Button variant='default' onClick={handleClose}>
            {t('common.button.cancel', {})}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
