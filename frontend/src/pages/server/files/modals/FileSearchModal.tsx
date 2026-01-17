import {
  faArrowTurnDown,
  faChevronDown,
  faFileAlt,
  faFolder,
  faHardDrive,
  faSearch,
  faSliders,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Box, Collapse, Flex, Group, ModalProps, Stack, Text, UnstyledButton } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { httpErrorToHuman } from '@/api/axios.ts';
import searchFiles from '@/api/server/files/searchFiles.ts';
import Button from '@/elements/Button.tsx';
import SizeInput from '@/elements/input/SizeInput.tsx';
import Switch from '@/elements/input/Switch.tsx';
import TagsInput from '@/elements/input/TagsInput.tsx';
import TextInput from '@/elements/input/TextInput.tsx';
import Modal from '@/elements/modals/Modal.tsx';
import { serverFilesSearchSchema } from '@/lib/schemas/server/files.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useGlobalStore } from '@/stores/global.ts';
import { useServerStore } from '@/stores/server.ts';

interface FilterSectionProps {
  icon: typeof faFolder;
  title: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
}

function FilterSection({ icon, title, enabled, onToggle, children }: FilterSectionProps) {
  return (
    <Box
      style={{
        background: enabled ? 'var(--mantine-color-dark-6)' : 'transparent',
        border: `1px solid ${enabled ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-dark-5)'}`,
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'all 0.15s ease',
      }}
    >
      <UnstyledButton
        onClick={() => onToggle(!enabled)}
        style={{
          width: '100%',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Box
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            background: enabled ? 'var(--mantine-color-blue-9)' : 'var(--mantine-color-dark-5)',
            transition: 'background 0.15s ease',
          }}
        >
          <FontAwesomeIcon
            icon={icon}
            size='xs'
            style={{ color: enabled ? 'var(--mantine-color-blue-2)' : 'var(--mantine-color-gray-5)' }}
          />
        </Box>
        <Text size='sm' fw={500} c={enabled ? 'gray.2' : 'gray.5'} style={{ flex: 1, textAlign: 'left' }}>
          {title}
        </Text>
        <FontAwesomeIcon
          icon={faChevronDown}
          size='xs'
          style={{
            color: 'var(--mantine-color-gray-6)',
            transform: enabled ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </UnstyledButton>
      <Collapse in={enabled}>
        <Box px='sm' pb='sm' pt={4}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
}

interface FileSearchModalProps extends ModalProps {
  onSearchComplete?: (searchInfo: { query?: string; filters: z.infer<typeof serverFilesSearchSchema> }) => void;
}

export default function FileSearchModal({ opened, onClose, onSearchComplete }: FileSearchModalProps) {
  const { addToast } = useToast();
  const { settings } = useGlobalStore();
  const { server, browsingFastDirectory, browsingDirectory, setBrowsingEntries } = useServerStore();

  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const form = useForm<z.infer<typeof serverFilesSearchSchema>>({
    initialValues: {
      pathFilter: null,
      sizeFilter: null,
      contentFilter: null,
    },
    validateInputOnBlur: true,
    validate: zod4Resolver(serverFilesSearchSchema),
  });

  useEffect(() => {
    if (
      form.values.contentFilter?.maxSearchSize &&
      form.values.contentFilter?.maxSearchSize > settings.server.maxFileManagerContentSearchSize
    ) {
      form.setFieldValue('contentFilter.maxSearchSize', settings.server.maxFileManagerContentSearchSize);
    }
  }, [form.values.contentFilter]);

  // Reset form when modal closes
  // biome-ignore lint/correctness/useExhaustiveDependencies: form.reset is stable
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

  // Auto-show advanced filters if any are active
  useEffect(() => {
    if (activeFiltersCount > 0) {
      setShowAdvanced(true);
    }
  }, [activeFiltersCount]);

  const doSearch = () => {
    setLoading(true);

    // Build the search filters - apply query as pathFilter if no explicit pathFilter is set
    const searchFilters = {
      ...form.values,
      pathFilter:
        form.values.pathFilter ??
        (query ? { include: [`**/*${query}*`], exclude: [], caseInsensitive: true } : null),
    };

    searchFiles(server.uuid, { root: browsingDirectory, ...searchFilters })
      .then((entries) => {
        setBrowsingEntries({ total: entries.length, page: 1, perPage: entries.length, data: entries });
        onSearchComplete?.({ query, filters: searchFilters });
        onClose();
      })
      .catch((msg) => {
        addToast(httpErrorToHuman(msg), 'error');
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title='Search Files' onClose={onClose} opened={opened} size='lg'>
      <form onSubmit={form.onSubmit(() => doSearch())}>
        <Stack gap='md'>
          {/* Main search input */}
          <TextInput
            placeholder='Search for files...'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftSection={<FontAwesomeIcon icon={faSearch} style={{ color: 'var(--mantine-color-gray-5)' }} />}
            size='md'
            autoFocus
          />

          {/* Advanced filters toggle */}
          <UnstyledButton onClick={() => setShowAdvanced(!showAdvanced)}>
            <Flex
              align='center'
              gap='sm'
              py='xs'
              px='sm'
              style={{
                borderRadius: 6,
                background: showAdvanced ? 'var(--mantine-color-dark-6)' : 'transparent',
                border: `1px solid ${showAdvanced ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-dark-5)'}`,
                transition: 'all 0.15s ease',
              }}
            >
              <Box
                style={{
                  width: 24,
                  height: 24,
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
                  style={{ color: activeFiltersCount > 0 ? 'var(--mantine-color-blue-2)' : 'var(--mantine-color-gray-5)' }}
                />
              </Box>
              <Text size='sm' c={showAdvanced ? 'gray.2' : 'gray.5'} fw={500}>
                Advanced Filters
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

          {/* Collapsible filters section */}
          <Collapse in={showAdvanced}>
            <Stack gap='xs'>
              <FilterSection
                icon={faFolder}
                title='Path Patterns'
                enabled={!!form.values.pathFilter}
                onToggle={(enabled) =>
                  form.setFieldValue(
                    'pathFilter',
                    enabled ? { include: [], exclude: [], caseInsensitive: true } : null,
                  )
                }
              >
                <Stack gap='sm'>
                  <Group grow align='start'>
                    <TagsInput
                      label='Include'
                      placeholder='e.g., *.js, src/**'
                      size='sm'
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
                      label='Exclude'
                      placeholder='e.g., node_modules/**'
                      size='sm'
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
                    label='Case insensitive'
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
              </FilterSection>

              {browsingFastDirectory && (
                <FilterSection
                  icon={faFileAlt}
                  title='File Content'
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
                        label='Search text'
                        placeholder='Text to find in files'
                        size='sm'
                        {...form.getInputProps('contentFilter.query')}
                      />
                      <SizeInput
                        label='Max file size'
                        mode='b'
                        min={0}
                        size='sm'
                        value={form.values.contentFilter?.maxSearchSize ?? 0}
                        onChange={(value) => form.setFieldValue('contentFilter.maxSearchSize', value)}
                      />
                    </Group>
                    <Group grow>
                      <Switch
                        label='Include oversized files'
                        description='Include files that match other filters but are too large to search'
                        {...form.getInputProps('contentFilter.includeUnmatched', { type: 'checkbox' })}
                      />
                      <Switch
                        label='Case insensitive'
                        {...form.getInputProps('contentFilter.caseInsensitive', { type: 'checkbox' })}
                      />
                    </Group>
                  </Stack>
                </FilterSection>
              )}

              <FilterSection
                icon={faHardDrive}
                title='File Size'
                enabled={!!form.values.sizeFilter}
                onToggle={(enabled) =>
                  form.setFieldValue('sizeFilter', enabled ? { min: 0, max: 100 * 1024 * 1024 } : null)
                }
              >
                <Group grow>
                  <SizeInput
                    label='Minimum'
                    mode='b'
                    min={0}
                    size='sm'
                    value={form.values.sizeFilter?.min ?? 0}
                    onChange={(value) => form.setFieldValue('sizeFilter.min', value)}
                  />
                  <SizeInput
                    label='Maximum'
                    mode='b'
                    min={0}
                    size='sm'
                    value={form.values.sizeFilter?.max ?? 0}
                    onChange={(value) => form.setFieldValue('sizeFilter.max', value)}
                  />
                </Group>
              </FilterSection>
            </Stack>
          </Collapse>
        </Stack>

        <Group mt='lg' justify='flex-end'>
          <Button type='submit' loading={loading} leftSection={<FontAwesomeIcon icon={faSearch} />}>
            Search
          </Button>
          <Button variant='default' onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
